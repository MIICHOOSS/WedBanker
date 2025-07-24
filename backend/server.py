from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
import hashlib

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
SECRET_KEY = "your-secret-key-here-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    username: str
    hashed_password: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserCreate(BaseModel):
    email: str
    username: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class Product(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    price: float
    category: str
    image_url: str
    in_stock: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ProductCreate(BaseModel):
    name: str
    description: str
    price: float
    category: str
    image_url: str

class CartItem(BaseModel):
    product_id: str
    quantity: int
    product_name: str
    product_price: float
    product_image: str

class Cart(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    items: List[CartItem] = []
    total_price: float = 0.0
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class AddToCartRequest(BaseModel):
    product_id: str
    quantity: int = 1

# Utility functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"email": email})
    if user is None:
        raise credentials_exception
    return User(**user)

# Routes
@api_router.get("/")
async def root():
    return {"message": "Pastry Shop API"}

# Authentication routes
@api_router.post("/register", response_model=dict)
async def register_user(user: UserCreate):
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create new user
    hashed_password = get_password_hash(user.password)
    new_user = User(
        email=user.email,
        username=user.username,
        hashed_password=hashed_password
    )
    
    await db.users.insert_one(new_user.dict())
    return {"message": "User created successfully"}

@api_router.post("/login", response_model=Token)
async def login_user(user_credentials: UserLogin):
    user = await db.users.find_one({"email": user_credentials.email})
    if not user or not verify_password(user_credentials.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["email"]}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@api_router.get("/me", response_model=dict)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "username": current_user.username
    }

# Product routes
@api_router.get("/products", response_model=List[Product])
async def get_products():
    products = await db.products.find().to_list(1000)
    return [Product(**product) for product in products]

@api_router.get("/products/category/{category}")
async def get_products_by_category(category: str):
    products = await db.products.find({"category": category}).to_list(1000)
    return [Product(**product) for product in products]

@api_router.get("/products/{product_id}", response_model=Product)
async def get_product(product_id: str):
    product = await db.products.find_one({"id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return Product(**product)

# Cart routes
@api_router.get("/cart")
async def get_cart(current_user: User = Depends(get_current_user)):
    cart = await db.carts.find_one({"user_id": current_user.id})
    if not cart:
        # Create empty cart
        new_cart = Cart(user_id=current_user.id)
        await db.carts.insert_one(new_cart.dict())
        return new_cart
    return Cart(**cart)

@api_router.post("/cart/add")
async def add_to_cart(request: AddToCartRequest, current_user: User = Depends(get_current_user)):
    # Get product details
    product = await db.products.find_one({"id": request.product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Get or create cart
    cart = await db.carts.find_one({"user_id": current_user.id})
    if not cart:
        cart = Cart(user_id=current_user.id)
    else:
        cart = Cart(**cart)
    
    # Check if item already in cart
    existing_item = None
    for i, item in enumerate(cart.items):
        if item.product_id == request.product_id:
            existing_item = i
            break
    
    if existing_item is not None:
        # Update quantity
        cart.items[existing_item].quantity += request.quantity
    else:
        # Add new item
        cart_item = CartItem(
            product_id=request.product_id,
            quantity=request.quantity,
            product_name=product["name"],
            product_price=product["price"],
            product_image=product["image_url"]
        )
        cart.items.append(cart_item)
    
    # Calculate total
    cart.total_price = sum(item.product_price * item.quantity for item in cart.items)
    cart.updated_at = datetime.utcnow()
    
    await db.carts.replace_one(
        {"user_id": current_user.id},
        cart.dict(),
        upsert=True
    )
    
    return {"message": "Item added to cart", "cart": cart}

@api_router.put("/cart/update/{product_id}")
async def update_cart_item(product_id: str, quantity: int, current_user: User = Depends(get_current_user)):
    cart = await db.carts.find_one({"user_id": current_user.id})
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")
    
    cart = Cart(**cart)
    
    # Find and update item
    for i, item in enumerate(cart.items):
        if item.product_id == product_id:
            if quantity <= 0:
                cart.items.pop(i)
            else:
                cart.items[i].quantity = quantity
            break
    else:
        raise HTTPException(status_code=404, detail="Item not found in cart")
    
    # Recalculate total
    cart.total_price = sum(item.product_price * item.quantity for item in cart.items)
    cart.updated_at = datetime.utcnow()
    
    await db.carts.replace_one({"user_id": current_user.id}, cart.dict())
    return {"message": "Cart updated", "cart": cart}

@api_router.delete("/cart/remove/{product_id}")
async def remove_from_cart(product_id: str, current_user: User = Depends(get_current_user)):
    cart = await db.carts.find_one({"user_id": current_user.id})
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")
    
    cart = Cart(**cart)
    
    # Remove item
    for i, item in enumerate(cart.items):
        if item.product_id == product_id:
            cart.items.pop(i)
            break
    else:
        raise HTTPException(status_code=404, detail="Item not found in cart")
    
    # Recalculate total
    cart.total_price = sum(item.product_price * item.quantity for item in cart.items)
    cart.updated_at = datetime.utcnow()
    
    await db.carts.replace_one({"user_id": current_user.id}, cart.dict())
    return {"message": "Item removed from cart", "cart": cart}

@api_router.delete("/cart/clear")
async def clear_cart(current_user: User = Depends(get_current_user)):
    await db.carts.delete_one({"user_id": current_user.id})
    return {"message": "Cart cleared"}

# Initialize sample data
@api_router.post("/init-data")
async def init_sample_data():
    # Check if products already exist
    existing_products = await db.products.count_documents({})
    if existing_products > 0:
        return {"message": "Sample data already exists"}
    
    sample_products = [
        {
            "name": "Bánh Croissant Bơ",
            "description": "Bánh croissant thơm ngon với lớp bơ tan chảy bên trong",
            "price": 45000,
            "category": "Bánh Mì",
            "image_url": "https://images.unsplash.com/photo-1555507036-ab1f4038808a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDN8MHwxfHNlYXJjaHwyfHxiYWtlcnl8ZW58MHx8fHwxNzUzMjAyNjYyfDA&ixlib=rb-4.1.0&q=85"
        },
        {
            "name": "Bánh Ngọt Việt Nam",
            "description": "Các loại bánh ngọt truyền thống Việt Nam",
            "price": 35000,
            "category": "Bánh Ngọt",
            "image_url": "https://images.unsplash.com/photo-1734520574432-dd1873c93092?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDN8MHwxfHNlYXJjaHwyfHx2aWV0bmFtZXNlJTIwcGFzdHJpZXN8ZW58MHx8fHwxNzUzMjAyNjU0fDA&ixlib=rb-4.1.0&q=85"
        },
        {
            "name": "Bánh Kem Sinh Nhật",
            "description": "Bánh kem sinh nhật thơm ngon, đẹp mắt",
            "price": 250000,
            "category": "Bánh Kem",
            "image_url": "https://images.unsplash.com/photo-1556745750-68295fefafc5?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDN8MXwxfHNlYXJjaHwxfHxiYWtlcnl8ZW58MHx8fHwxNzUzMjAyNjYyfDA&ixlib=rb-4.1.0&q=85"
        },
        {
            "name": "Bánh Macaron Pháp",
            "description": "Bánh macaron Pháp nhiều hương vị",
            "price": 80000,
            "category": "Bánh Ngọt",
            "image_url": "https://images.unsplash.com/photo-1483695028939-5bb13f8648b0?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDN8MHwxfHNlYXJjaHwzfHx2aWV0bmFtZXNlJTIwcGFzdHJpZXN8ZW58MHx8fHwxNzUzMjAyNjYyfDA&ixlib=rb-4.1.0&q=85"
        },
        {
            "name": "Bánh Donut Truyền Thống",
            "description": "Bánh donut chiên giòn, phủ đường",
            "price": 25000,
            "category": "Bánh Ngọt",
            "image_url": "https://images.unsplash.com/photo-1663667150807-925ddb84621d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDN8MHwxfHNlYXJjaHwzfHx2aWV0bmFtZXNlJTIwcGFzdHJpZXN8ZW58MHx8fHwxNzUzMjAyNjU0fDA&ixlib=rb-4.1.0&q=85"
        },
        {
            "name": "Bánh Cupcake Mini",
            "description": "Bánh cupcake mini đáng yêu, nhiều màu sắc",
            "price": 30000,
            "category": "Bánh Kem",
            "image_url": "https://images.unsplash.com/photo-1612177434015-83ee396a236d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDN8MHwxfHNlYXJjaHwxfHx2aWV0bmFtZXNlJTIwcGFzdHJpZXN8ZW58MHx8fHwxNzUzMjAyNjU0fDA&ixlib=rb-4.1.0&q=85"
        }
    ]
    
    products = [Product(**product) for product in sample_products]
    await db.products.insert_many([product.dict() for product in products])
    
    return {"message": "Sample data initialized successfully"}

# Include router
app.include_router(api_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()