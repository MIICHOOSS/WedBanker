#!/usr/bin/env python3
"""
Comprehensive Backend Testing for Vietnamese Pastry E-commerce Website
Tests all backend APIs including authentication, products, and cart functionality
"""

import requests
import json
import sys
import os
from datetime import datetime

# Get backend URL from frontend .env file
def get_backend_url():
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
    except Exception as e:
        print(f"Error reading frontend .env: {e}")
        return None

BASE_URL = get_backend_url()
if not BASE_URL:
    print("❌ Could not get backend URL from frontend/.env")
    sys.exit(1)

API_BASE = f"{BASE_URL}/api"
print(f"🔗 Testing backend at: {API_BASE}")

# Test data
TEST_USER = {
    "email": "nguyen.van.a@gmail.com",
    "username": "nguyenvana",
    "password": "matkhau123"
}

TEST_USER_2 = {
    "email": "tran.thi.b@gmail.com", 
    "username": "tranthib",
    "password": "matkhau456"
}

# Global variables for test state
auth_token = None
user_info = None
products = []
test_product_id = None
cart_data = None

def print_test_header(test_name):
    print(f"\n{'='*60}")
    print(f"🧪 TESTING: {test_name}")
    print(f"{'='*60}")

def print_success(message):
    print(f"✅ {message}")

def print_error(message):
    print(f"❌ {message}")

def print_info(message):
    print(f"ℹ️  {message}")

def make_request(method, endpoint, data=None, headers=None, expect_success=True):
    """Make HTTP request with error handling"""
    url = f"{API_BASE}{endpoint}"
    
    try:
        if method.upper() == 'GET':
            response = requests.get(url, headers=headers, timeout=10)
        elif method.upper() == 'POST':
            response = requests.post(url, json=data, headers=headers, timeout=10)
        elif method.upper() == 'PUT':
            response = requests.put(url, json=data, headers=headers, timeout=10)
        elif method.upper() == 'DELETE':
            response = requests.delete(url, headers=headers, timeout=10)
        else:
            raise ValueError(f"Unsupported method: {method}")
            
        print(f"📡 {method.upper()} {endpoint} -> Status: {response.status_code}")
        
        if expect_success and response.status_code >= 400:
            print(f"❌ Request failed: {response.text}")
            return None
            
        return response
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Network error: {e}")
        return None

def test_root_endpoint():
    """Test the root API endpoint"""
    print_test_header("Root API Endpoint")
    
    response = make_request('GET', '/')
    if response and response.status_code == 200:
        data = response.json()
        if data.get('message') == 'Pastry Shop API':
            print_success("Root endpoint working correctly")
            return True
        else:
            print_error(f"Unexpected response: {data}")
    
    print_error("Root endpoint test failed")
    return False

def test_sample_data_initialization():
    """Test sample data initialization"""
    print_test_header("Sample Data Initialization")
    
    response = make_request('POST', '/init-data')
    if response and response.status_code == 200:
        data = response.json()
        print_success(f"Sample data initialization: {data.get('message')}")
        return True
    
    print_error("Sample data initialization failed")
    return False

def test_user_registration():
    """Test user registration"""
    print_test_header("User Registration")
    
    # Test successful registration
    response = make_request('POST', '/register', TEST_USER)
    if response and response.status_code == 200:
        data = response.json()
        print_success(f"User registration successful: {data.get('message')}")
        
        # Test duplicate registration (should fail)
        response2 = make_request('POST', '/register', TEST_USER, expect_success=False)
        if response2 and response2.status_code == 400:
            error_data = response2.json()
            if "already registered" in error_data.get('detail', '').lower():
                print_success("Duplicate registration properly rejected")
                return True
            else:
                print_error(f"Unexpected error message: {error_data}")
        else:
            print_error("Duplicate registration not properly handled")
    
    print_error("User registration test failed")
    return False

def test_user_login():
    """Test user login and token generation"""
    print_test_header("User Login")
    global auth_token
    
    # Test successful login
    login_data = {
        "email": TEST_USER["email"],
        "password": TEST_USER["password"]
    }
    
    response = make_request('POST', '/login', login_data)
    if response and response.status_code == 200:
        data = response.json()
        auth_token = data.get('access_token')
        token_type = data.get('token_type')
        
        if auth_token and token_type == 'bearer':
            print_success(f"Login successful, token received: {auth_token[:20]}...")
            
            # Test invalid login
            invalid_login = {
                "email": TEST_USER["email"],
                "password": "wrong_password"
            }
            response2 = make_request('POST', '/login', invalid_login, expect_success=False)
            if response2 and response2.status_code == 401:
                error_data = response2.json()
                if "incorrect" in error_data.get('detail', '').lower():
                    print_success("Invalid login properly rejected")
                    return True
                else:
                    print_error(f"Unexpected error message: {error_data}")
            else:
                print_error("Invalid login not properly handled")
        else:
            print_error("Token not received or invalid format")
    
    print_error("User login test failed")
    return False

def test_authenticated_user_info():
    """Test getting authenticated user information"""
    print_test_header("Authenticated User Info")
    global user_info
    
    if not auth_token:
        print_error("No auth token available")
        return False
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    response = make_request('GET', '/me', headers=headers)
    
    if response and response.status_code == 200:
        user_info = response.json()
        expected_fields = ['id', 'email', 'username']
        
        if all(field in user_info for field in expected_fields):
            print_success(f"User info retrieved: {user_info['username']} ({user_info['email']})")
            return True
        else:
            print_error(f"Missing fields in user info: {user_info}")
    
    print_error("Authenticated user info test failed")
    return False

def test_product_retrieval():
    """Test product retrieval endpoints"""
    print_test_header("Product Retrieval")
    global products, test_product_id
    
    # Test get all products
    response = make_request('GET', '/products')
    if response and response.status_code == 200:
        products = response.json()
        
        if len(products) > 0:
            print_success(f"Retrieved {len(products)} products")
            test_product_id = products[0]['id']
            
            # Print sample product info
            sample_product = products[0]
            print_info(f"Sample product: {sample_product['name']} - {sample_product['price']}đ")
            
            return True
        else:
            print_error("No products found")
    
    print_error("Product retrieval test failed")
    return False

def test_product_filtering():
    """Test product filtering by category"""
    print_test_header("Product Category Filtering")
    
    if not products:
        print_error("No products available for filtering test")
        return False
    
    # Get unique categories
    categories = list(set(product['category'] for product in products))
    print_info(f"Available categories: {categories}")
    
    success_count = 0
    for category in categories:
        response = make_request('GET', f'/products/category/{category}')
        if response and response.status_code == 200:
            filtered_products = response.json()
            expected_count = len([p for p in products if p['category'] == category])
            
            if len(filtered_products) == expected_count:
                print_success(f"Category '{category}': {len(filtered_products)} products")
                success_count += 1
            else:
                print_error(f"Category '{category}': Expected {expected_count}, got {len(filtered_products)}")
    
    return success_count == len(categories)

def test_individual_product():
    """Test getting individual product by ID"""
    print_test_header("Individual Product Retrieval")
    
    if not test_product_id:
        print_error("No test product ID available")
        return False
    
    response = make_request('GET', f'/products/{test_product_id}')
    if response and response.status_code == 200:
        product = response.json()
        
        if product['id'] == test_product_id:
            print_success(f"Individual product retrieved: {product['name']}")
            return True
        else:
            print_error("Product ID mismatch")
    
    print_error("Individual product retrieval test failed")
    return False

def test_cart_operations():
    """Test shopping cart operations"""
    print_test_header("Shopping Cart Operations")
    global cart_data
    
    if not auth_token or not test_product_id:
        print_error("Missing auth token or test product ID")
        return False
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    # Test get empty cart
    response = make_request('GET', '/cart', headers=headers)
    if response and response.status_code == 200:
        cart_data = response.json()
        print_success(f"Empty cart retrieved: {len(cart_data.get('items', []))} items")
    else:
        print_error("Failed to get initial cart")
        return False
    
    # Test add to cart
    add_request = {
        "product_id": test_product_id,
        "quantity": 2
    }
    
    response = make_request('POST', '/cart/add', add_request, headers=headers)
    if response and response.status_code == 200:
        data = response.json()
        cart_data = data.get('cart')
        
        if cart_data and len(cart_data['items']) == 1:
            item = cart_data['items'][0]
            if item['quantity'] == 2 and item['product_id'] == test_product_id:
                print_success(f"Item added to cart: {item['product_name']} x{item['quantity']}")
                print_info(f"Cart total: {cart_data['total_price']}đ")
            else:
                print_error("Cart item data incorrect")
                return False
        else:
            print_error("Cart not updated correctly")
            return False
    else:
        print_error("Failed to add item to cart")
        return False
    
    return True

def test_cart_update():
    """Test updating cart item quantity"""
    print_test_header("Cart Item Update")
    
    if not auth_token or not test_product_id:
        print_error("Missing auth token or test product ID")
        return False
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    # Update quantity to 5
    response = make_request('PUT', f'/cart/update/{test_product_id}?quantity=5', headers=headers)
    if response and response.status_code == 200:
        data = response.json()
        cart_data = data.get('cart')
        
        if cart_data and len(cart_data['items']) == 1:
            item = cart_data['items'][0]
            if item['quantity'] == 5:
                print_success(f"Cart quantity updated: {item['product_name']} x{item['quantity']}")
                print_info(f"Updated cart total: {cart_data['total_price']}đ")
                return True
            else:
                print_error(f"Quantity not updated correctly: {item['quantity']}")
        else:
            print_error("Cart update failed")
    
    print_error("Cart update test failed")
    return False

def test_cart_remove():
    """Test removing item from cart"""
    print_test_header("Cart Item Removal")
    
    if not auth_token or not test_product_id:
        print_error("Missing auth token or test product ID")
        return False
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    response = make_request('DELETE', f'/cart/remove/{test_product_id}', headers=headers)
    if response and response.status_code == 200:
        data = response.json()
        cart_data = data.get('cart')
        
        if cart_data and len(cart_data['items']) == 0:
            print_success("Item removed from cart successfully")
            print_info(f"Cart total after removal: {cart_data['total_price']}đ")
            return True
        else:
            print_error("Item not removed correctly")
    
    print_error("Cart removal test failed")
    return False

def test_cart_clear():
    """Test clearing entire cart"""
    print_test_header("Cart Clear")
    
    if not auth_token:
        print_error("Missing auth token")
        return False
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    # Add item first
    add_request = {
        "product_id": test_product_id,
        "quantity": 1
    }
    make_request('POST', '/cart/add', add_request, headers=headers)
    
    # Clear cart
    response = make_request('DELETE', '/cart/clear', headers=headers)
    if response and response.status_code == 200:
        data = response.json()
        if data.get('message') == 'Cart cleared':
            print_success("Cart cleared successfully")
            
            # Verify cart is empty
            response2 = make_request('GET', '/cart', headers=headers)
            if response2 and response2.status_code == 200:
                cart_data = response2.json()
                if len(cart_data.get('items', [])) == 0:
                    print_success("Cart confirmed empty after clear")
                    return True
                else:
                    print_error("Cart not empty after clear")
            else:
                print_error("Failed to verify empty cart")
        else:
            print_error("Unexpected clear response")
    
    print_error("Cart clear test failed")
    return False

def run_all_tests():
    """Run all backend tests"""
    print(f"\n🚀 STARTING COMPREHENSIVE BACKEND TESTING")
    print(f"📅 Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🔗 Backend URL: {API_BASE}")
    
    test_results = {}
    
    # Test sequence
    tests = [
        ("Root Endpoint", test_root_endpoint),
        ("Sample Data Initialization", test_sample_data_initialization),
        ("User Registration", test_user_registration),
        ("User Login", test_user_login),
        ("Authenticated User Info", test_authenticated_user_info),
        ("Product Retrieval", test_product_retrieval),
        ("Product Category Filtering", test_product_filtering),
        ("Individual Product", test_individual_product),
        ("Cart Operations", test_cart_operations),
        ("Cart Update", test_cart_update),
        ("Cart Remove", test_cart_remove),
        ("Cart Clear", test_cart_clear)
    ]
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            test_results[test_name] = result
        except Exception as e:
            print_error(f"Test '{test_name}' crashed: {e}")
            test_results[test_name] = False
    
    # Print summary
    print(f"\n{'='*60}")
    print("📊 TEST SUMMARY")
    print(f"{'='*60}")
    
    passed = sum(1 for result in test_results.values() if result)
    total = len(test_results)
    
    for test_name, result in test_results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
    
    print(f"\n🎯 OVERALL RESULT: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED! Backend is working correctly.")
        return True
    else:
        print(f"⚠️  {total - passed} tests failed. Backend needs attention.")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)