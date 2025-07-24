import React, { useState, useEffect, createContext, useContext } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL;

// Context for authentication and cart
const AppContext = createContext();

const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

// AppProvider component
const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [cart, setCart] = useState({ items: [], total_price: 0 });
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem('token');

  // Setup axios interceptors
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      getCurrentUser();
    }
  }, [token]);

  const getCurrentUser = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/me`);
      setUser(response.data);
    } catch (error) {
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
    }
  };

  const login = async (email, password) => {
    try {
      setLoading(true);
      const response = await axios.post(`${API_BASE_URL}/api/login`, {
        email,
        password
      });
      
      const { access_token } = response.data;
      localStorage.setItem('token', access_token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      await getCurrentUser();
      await getCart();
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Đăng nhập thất bại' 
      };
    } finally {
      setLoading(false);
    }
  };

  const register = async (email, username, password) => {
    try {
      setLoading(true);
      await axios.post(`${API_BASE_URL}/api/register`, {
        email,
        username,
        password
      });
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Đăng ký thất bại' 
      };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    setCart({ items: [], total_price: 0 });
  };

  const getProducts = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/products`);
      setProducts(response.data);
    } catch (error) {
      console.error('Lỗi khi lấy sản phẩm:', error);
    }
  };

  const getCart = async () => {
    try {
      if (user || token) {
        const response = await axios.get(`${API_BASE_URL}/api/cart`);
        setCart(response.data);
      }
    } catch (error) {
      console.error('Lỗi khi lấy giỏ hàng:', error);
    }
  };

  const addToCart = async (productId, quantity = 1) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/cart/add`, {
        product_id: productId,
        quantity
      });
      setCart(response.data.cart);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Không thể thêm vào giỏ hàng' 
      };
    }
  };

  const updateCartItem = async (productId, quantity) => {
    try {
      const response = await axios.put(`${API_BASE_URL}/api/cart/update/${productId}?quantity=${quantity}`);
      setCart(response.data.cart);
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Không thể cập nhật giỏ hàng' };
    }
  };

  const removeFromCart = async (productId) => {
    try {
      const response = await axios.delete(`${API_BASE_URL}/api/cart/remove/${productId}`);
      setCart(response.data.cart);
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Không thể xóa sản phẩm' };
    }
  };

  const value = {
    user,
    cart,
    products,
    loading,
    login,
    register,
    logout,
    getProducts,
    getCart,
    addToCart,
    updateCartItem,
    removeFromCart
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

// Header Component
const Header = () => {
  const { user, cart, logout } = useAppContext();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCartModal, setShowCartModal] = useState(false);

  const totalItems = cart.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  return (
    <>
      <header className="bg-gradient-to-r from-amber-50 to-orange-100 shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xl font-bold">🧁</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Tiệm Bánh Ngọt</h1>
                <p className="text-sm text-gray-600">Hương vị truyền thống</p>
              </div>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex space-x-8">
              <a href="#home" className="text-gray-700 hover:text-orange-600 font-medium transition-colors">
                Trang Chủ
              </a>
              <a href="#products" className="text-gray-700 hover:text-orange-600 font-medium transition-colors">
                Sản Phẩm
              </a>
              <a href="#about" className="text-gray-700 hover:text-orange-600 font-medium transition-colors">
                Giới Thiệu
              </a>
              <a href="#contact" className="text-gray-700 hover:text-orange-600 font-medium transition-colors">
                Liên Hệ
              </a>
            </nav>

            {/* User Actions */}
            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  <span className="text-gray-700">Xin chào, {user.username}!</span>
                  <button
                    onClick={() => setShowCartModal(true)}
                    className="relative p-2 text-gray-700 hover:text-orange-600 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4m.1.1L7 13M7 13l-2.293 2.293A1 1 0 005 17v0a1 1 0 001 1h1M17 13v4a2 2 0 01-2 2H9a2 2 0 01-2-2v-4m8 0V9a2 2 0 00-2-2H9a2 2 0 00-2 2v4.01" />
                    </svg>
                    {totalItems > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                        {totalItems}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={logout}
                    className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
                  >
                    Đăng Xuất
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-6 py-2 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all transform hover:scale-105 font-medium"
                >
                  Đăng Nhập
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Modals */}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      {showCartModal && <CartModal onClose={() => setShowCartModal(false)} />}
    </>
  );
};

// Auth Modal Component
const AuthModal = ({ onClose }) => {
  const { login, register, loading } = useAppContext();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: ''
  });
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    if (isLogin) {
      const result = await login(formData.email, formData.password);
      if (result.success) {
        onClose();
      } else {
        setMessage(result.error);
      }
    } else {
      const result = await register(formData.email, formData.username, formData.password);
      if (result.success) {
        setMessage('Đăng ký thành công! Vui lòng đăng nhập.');
        setIsLogin(true);
        setFormData({ email: '', username: '', password: '' });
      } else {
        setMessage(result.error);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-2xl max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">
            {isLogin ? 'Đăng Nhập' : 'Đăng Ký'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Nhập email của bạn"
            />
          </div>

          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tên người dùng</label>
              <input
                type="text"
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Nhập tên người dùng"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mật khẩu</label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Nhập mật khẩu"
            />
          </div>

          {message && (
            <div className={`p-3 rounded-lg text-sm ${
              message.includes('thành công') 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white py-3 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all font-medium disabled:opacity-50"
          >
            {loading ? 'Đang xử lý...' : (isLogin ? 'Đăng Nhập' : 'Đăng Ký')}
          </button>

          <div className="text-center mt-4">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setMessage('');
                setFormData({ email: '', username: '', password: '' });
              }}
              className="text-orange-600 hover:text-orange-700 font-medium"
            >
              {isLogin ? 'Chưa có tài khoản? Đăng ký ngay' : 'Đã có tài khoản? Đăng nhập'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Cart Modal Component
const CartModal = ({ onClose }) => {
  const { cart, updateCartItem, removeFromCart } = useAppContext();

  const handleQuantityChange = async (productId, quantity) => {
    if (quantity < 1) {
      await removeFromCart(productId);
    } else {
      await updateCartItem(productId, quantity);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Giỏ Hàng</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {cart.items && cart.items.length > 0 ? (
          <>
            <div className="space-y-4">
              {cart.items.map((item) => (
                <div key={item.product_id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                  <img
                    src={item.product_image}
                    alt={item.product_name}
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-800">{item.product_name}</h3>
                    <p className="text-gray-600">{formatPrice(item.product_price)}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleQuantityChange(item.product_id, item.quantity - 1)}
                      className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300"
                    >
                      -
                    </button>
                    <span className="w-8 text-center">{item.quantity}</span>
                    <button
                      onClick={() => handleQuantityChange(item.product_id, item.quantity + 1)}
                      className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300"
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.product_id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-6 border-t pt-4">
              <div className="flex justify-between items-center text-xl font-bold">
                <span>Tổng cộng:</span>
                <span className="text-orange-600">{formatPrice(cart.total_price || 0)}</span>
              </div>
              <button className="w-full mt-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-3 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all font-medium">
                Thanh Toán
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">🛒</div>
            <p className="text-gray-500 text-lg">Giỏ hàng của bạn đang trống</p>
            <button
              onClick={onClose}
              className="mt-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white px-6 py-2 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all"
            >
              Tiếp Tục Mua Sắm
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Hero Section Component
const HeroSection = () => {
  return (
    <section id="home" className="relative bg-gradient-to-br from-amber-50 to-orange-100 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-20"></div>
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: 'url("https://images.unsplash.com/photo-1612177434015-83ee396a236d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDN8MHwxfHNlYXJjaHwxfHx2aWV0bmFtZXNlJTIwcGFzdHJpZXN8ZW58MHx8fHwxNzUzMjAyNjU0fDA&ixlib=rb-4.1.0&q=85")',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent"></div>
      </div>
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center md:text-left max-w-2xl">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
            Bánh Ngọt
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-400">
              Truyền Thống
            </span>
          </h1>
          <p className="text-xl text-gray-100 mb-8 leading-relaxed">
            Khám phá thế giới bánh ngọt đậm đà hương vị Việt Nam với những công thức gia truyền được chế biến tỉ mỉ từ nguyên liệu tự nhiên.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="#products"
              className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-8 py-4 rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all transform hover:scale-105 font-semibold text-lg shadow-lg"
            >
              Khám Phá Sản Phẩm
            </a>
            <a
              href="#about"
              className="bg-white/20 backdrop-blur-sm text-white px-8 py-4 rounded-xl hover:bg-white/30 transition-all border border-white/30 font-semibold text-lg"
            >
              Tìm Hiểu Thêm
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

// Product Card Component
const ProductCard = ({ product }) => {
  const { user, addToCart } = useAppContext();
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  };

  const handleAddToCart = async () => {
    if (!user) {
      setShowAuthPrompt(true);
      setTimeout(() => setShowAuthPrompt(false), 3000);
      return;
    }

    setIsAdding(true);
    const result = await addToCart(product.id);
    if (result.success) {
      // Add success feedback
    }
    setIsAdding(false);
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 group">
      <div className="relative overflow-hidden">
        <img
          src={product.image_url}
          alt={product.name}
          className="w-full h-64 object-cover group-hover:scale-110 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity duration-300"></div>
        <div className="absolute top-4 right-4">
          <span className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-3 py-1 rounded-full text-sm font-medium">
            {product.category}
          </span>
        </div>
      </div>
      
      <div className="p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-2">{product.name}</h3>
        <p className="text-gray-600 mb-4 text-sm leading-relaxed">{product.description}</p>
        
        <div className="flex justify-between items-center">
          <span className="text-2xl font-bold text-orange-600">
            {formatPrice(product.price)}
          </span>
          <button
            onClick={handleAddToCart}
            disabled={isAdding}
            className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-6 py-2 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all transform hover:scale-105 font-medium disabled:opacity-50 flex items-center space-x-2"
          >
            {isAdding ? (
              <span>Đang thêm...</span>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4m.1.1L7 13M7 13l-2.293 2.293A1 1 0 005 17v0a1 1 0 001 1h1M17 13v4a2 2 0 01-2 2H9a2 2 0 01-2-2v-4m8 0V9a2 2 0 00-2-2H9a2 2 0 00-2 2v4.01" />
                </svg>
                <span>Thêm vào giỏ</span>
              </>
            )}
          </button>
        </div>
        
        {showAuthPrompt && (
          <div className="mt-3 p-3 bg-amber-100 text-amber-800 rounded-lg text-sm">
            Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng!
          </div>
        )}
      </div>
    </div>
  );
};

// Products Section Component
const ProductsSection = () => {
  const { products, getProducts } = useAppContext();
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');

  useEffect(() => {
    getProducts();
  }, []);

  const categories = ['Tất cả', ...new Set(products.map(p => p.category))];
  const filteredProducts = selectedCategory === 'Tất cả' 
    ? products 
    : products.filter(p => p.category === selectedCategory);

  return (
    <section id="products" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-800 mb-4">Sản Phẩm Của Chúng Tôi</h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Khám phá bộ sưu tập bánh ngọt đa dạng, từ truyền thống đến hiện đại
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-6 py-3 rounded-full font-medium transition-all ${
                selectedCategory === category
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg'
                  : 'bg-white text-gray-700 hover:bg-gray-100 shadow'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🧁</div>
            <p className="text-xl text-gray-500">Không tìm thấy sản phẩm nào</p>
          </div>
        )}
      </div>
    </section>
  );
};

// About Section Component
const AboutSection = () => {
  return (
    <section id="about" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-4xl font-bold text-gray-800 mb-6">Câu Chuyện Của Chúng Tôi</h2>
            <p className="text-lg text-gray-600 mb-6 leading-relaxed">
              Được thành lập từ năm 1995, Tiệm Bánh Ngọt đã trở thành điểm đến quen thuộc của những người yêu thích bánh ngọt chất lượng cao tại Việt Nam.
            </p>
            <p className="text-lg text-gray-600 mb-8 leading-relaxed">
              Chúng tôi tự hào mang đến những sản phẩm bánh ngọt được chế biến từ những nguyên liệu tươi ngon nhất, kết hợp giữa công thức truyền thống và kỹ thuật hiện đại.
            </p>
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-600">25+</div>
                <p className="text-gray-600">Năm kinh nghiệm</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-600">1000+</div>
                <p className="text-gray-600">Khách hàng hài lòng</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-600">50+</div>
                <p className="text-gray-600">Loại bánh khác nhau</p>
              </div>
            </div>
          </div>
          <div className="relative">
            <img
              src="https://images.unsplash.com/photo-1556745750-68295fefafc5?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDN8MXwxfHNlYXJjaHwxfHxiYWtlcnl8ZW58MHx8fHwxNzUzMjAyNjYyfDA&ixlib=rb-4.1.0&q=85"
              alt="Về chúng tôi"
              className="rounded-2xl shadow-2xl"
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/20 to-transparent rounded-2xl"></div>
          </div>
        </div>
      </div>
    </section>
  );
};

// Footer Component
const Footer = () => {
  return (
    <footer id="contact" className="bg-gray-800 text-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xl font-bold">🧁</span>
              </div>
              <div>
                <h3 className="text-2xl font-bold">Tiệm Bánh Ngọt</h3>
                <p className="text-gray-300">Hương vị truyền thống</p>
              </div>
            </div>
            <p className="text-gray-300 mb-4">
              Chúng tôi mang đến những sản phẩm bánh ngọt chất lượng cao, được chế biến từ tình yêu và tâm huyết.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-gray-300 hover:text-white">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/>
                </svg>
              </a>
              <a href="#" className="text-gray-300 hover:text-white">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M22.46 6c-.77.35-1.6.58-2.46.69.88-.53 1.56-1.37 1.88-2.38-.83.5-1.75.85-2.72 1.05C18.37 4.5 17.26 4 16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98C8.28 9.09 5.11 7.38 3 4.79c-.37.63-.58 1.37-.58 2.15 0 1.49.75 2.81 1.91 3.56-.71 0-1.37-.2-1.95-.5v.03c0 2.08 1.48 3.82 3.44 4.21a4.22 4.22 0 0 1-1.93.07 4.28 4.28 0 0 0 4 2.98 8.521 8.521 0 0 1-5.33 1.84c-.34 0-.68-.02-1.02-.06C3.44 20.29 5.7 21 8.12 21 16 21 20.33 14.46 20.33 8.79c0-.19 0-.37-.01-.56.84-.6 1.566-1.36 2.14-2.23z"/>
                </svg>
              </a>
            </div>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold mb-4">Liên Hệ</h4>
            <div className="space-y-2 text-gray-300">
              <p>📍 123 Đường ABC, Quận 1, TP.HCM</p>
              <p>📞 (028) 1234 5678</p>
              <p>✉️ info@tiembanhngot.com</p>
            </div>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold mb-4">Giờ Mở Cửa</h4>
            <div className="space-y-2 text-gray-300">
              <p>Thứ 2 - Thứ 6: 7:00 - 21:00</p>
              <p>Thứ 7 - Chủ Nhật: 8:00 - 22:00</p>
            </div>
          </div>
        </div>
        
        <div className="border-t border-gray-700 mt-12 pt-8 text-center text-gray-300">
          <p>&copy; 2024 Tiệm Bánh Ngọt. Tất cả các quyền được bảo lưu.</p>
        </div>
      </div>
    </footer>
  );
};

// Main App Component
function App() {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Initialize sample data on first load
    const initData = async () => {
      try {
        await axios.post(`${API_BASE_URL}/api/init-data`);
        setIsInitialized(true);
      } catch (error) {
        console.error('Lỗi khởi tạo dữ liệu:', error);
        setIsInitialized(true); // Continue anyway
      }
    };

    initData();
  }, []);

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-bold">🧁</span>
          </div>
          <p className="text-xl text-gray-700">Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <AppProvider>
      <div className="App">
        <Header />
        <HeroSection />
        <ProductsSection />
        <AboutSection />
        <Footer />
      </div>
    </AppProvider>
  );
}

export default App;