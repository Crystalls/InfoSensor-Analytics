import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useNavigate } from 'react-router-dom';
import RegistrationForm from './components/Registration/RegistrationForm';
import LoginForm from './components/Login/LoginForm';
import DashboardScientist from './components/Dashboard/DashboardScientist';
import DashboardEngineer from './components/Dashboard/DashboardEngineer';
import Navbar from './components/Navbar/Navbar';
import AssetRegistry from './components/Dashboard/AssetRegistry';
import OverviewDashboard from './components/Dashboard/OverviewDashboard';
import axios from 'axios';
import { API_BASE_URL } from './services/api';

// --- КОМПОНЕНТ App ---
function App() {
    // Состояние аутентификации управляется непосредственно в App.js
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [isLoadingAuth, setIsLoadingAuth] = useState(true); // Для первой загрузки

    // Загрузка состояния при монтировании компонента
    useEffect(() => {
        const storedToken = localStorage.getItem('token');
        const userData = localStorage.getItem('user');

        if (storedToken && userData) {
            try {
                const parsedUser = JSON.parse(userData);
                setIsLoggedIn(true);
                setUser(parsedUser);
                setToken(storedToken);
            } catch (error) {
                console.error("Error parsing user data from localStorage:", error);
                // Очищаем localStorage, если данные некорректны
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                setIsLoggedIn(false);
                setUser(null);
                setToken(null);
            }
        } else {
            // Если токена или данных нет, сбрасываем состояние
            setIsLoggedIn(false);
            setUser(null);
            setToken(null);
        }
        setIsLoadingAuth(false); // Завершили проверку
    }, []); // Пустой массив зависимостей - выполняется один раз при старте

    // Функция логина, которая обновляет состояние App
    const handleLogin = useCallback(async (newToken, userData) => {
        try {
            localStorage.setItem('token', newToken);
            localStorage.setItem('user', JSON.stringify(userData));
            
            setIsLoggedIn(true);
            setUser(userData);
            setToken(newToken);
            console.log('Token set in App:', newToken)
            
        } catch (error) {
            console.error("Login error:", error.response?.data?.message || error.message);
            throw error; // Возвращаем ошибку для обработки во фронтенде
        }
    }, []); // Зависимости для useCallback

    // Функция логаута, которая обновляет состояние App
    const handleLogout = useCallback(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setIsLoggedIn(false);
        setUser(null);
        setToken(null);
    }, []); // Зависимости для useCallback

    // --- Компонент для защиты роутов ---
    const PrivateRoute = ({ children, allowedProfession }) => {
        // Используем состояние, которое управляется в App.js
        
        // Если идет загрузка, показываем индикатор
        if (isLoadingAuth) {
            return <div>Loading authentication...</div>;
        }

        // Если пользователь не залогинен или токен отсутствует, перенаправляем на логин
        if (!isLoggedIn || !token) {
            return <Navigate to="/login" replace />;
        }

        if (!user || !token) { 
            return <div>Загрузка данных сессии...</div>; 
        }

        // Если роут требует конкретную профессию, а у пользователя ее нет
        if (allowedProfession && user && user.profession !== allowedProfession) {
            console.warn(`User ${user.username} does not have required profession: ${allowedProfession}`);
            // Перенаправляем на страницу, соответствующую профессии пользователя, или на страницу ошибки
            if (user.profession === 'engineer') {
                return <Navigate to="/dashboard-engineer" replace />;
            } else if (user.profession === 'scientist') {
                return <Navigate to="/dashboard" replace />;
            } else {
                // Если профессия неизвестна или не соответствует ни одному роуту
                return <Navigate to="/login" replace />; // Или на страницу 404/Error
            }
        }

        // Если все проверки пройдены, рендерим дочерние элементы
        const elementWithProps = React.cloneElement(children, { user, token });

        return elementWithProps;
    };

    // --- Вспомогательный компонент для корневой страницы ---
    const HomePage = () => {
        const navigate = useNavigate(); // Хук для навигации

        useEffect(() => {
            if (isLoadingAuth) return; // Ждем завершения проверки аутентификации

            if (isLoggedIn) {
                // Если залогинен, перенаправляем на дашборд
                navigate('/dashboard', { replace: true });
            } else {
                // Если не залогинен, перенаправляем на логин
                navigate('/login', { replace: true });
            }
        }, [isLoggedIn, isLoadingAuth, navigate]); // Зависимости: меняем, если меняется статус логина/загрузки/навигация

        // Пока идет загрузка, можно показать индикатор
        if (isLoadingAuth) {
            return <div>Loading...</div>;
        }
        
        return null; // Не рендерим ничего, пока идет перенаправление
    };

    return (
        <Router>
            <div>
                {/* Navbar получает isLoggedIn User и handleLogout */}
                <Navbar isLoggedIn={isLoggedIn} onLogout={handleLogout} user={user} />

                <Routes>
                    {/* Корневой роут, который перенаправляет в зависимости от статуса логина */}
                    <Route path="/" element={<HomePage />} /> 

                    <Route path="/register" element={<RegistrationForm />} />
                    
                    {/* LoginForm теперь получает handleLogin */}
                    <Route path="/login" element={<LoginForm onLogin={handleLogin} />} /> 
                    
                    <Route
                        path="/overview"
                        element={
                            <PrivateRoute>
                                <OverviewDashboard user={user} />
                            </PrivateRoute>
                        }
                    />
                    
                    <Route
                        path="/assets"
                        element={
                            <PrivateRoute>
                                <AssetRegistry user={user} token={token} />
                            </PrivateRoute>
                        }
                    />

                    {/* Защищенный роут для Дашборда Ученого */}
                    <Route
                        path="/dashboard-scientist"
                        element={
                            <PrivateRoute allowedProfession="scientist">
                                <DashboardScientist />
                            </PrivateRoute>
                        }
                    />
                    
                    {/* Защищенный роут для Дашборда Инженера */}
                    <Route
                        path="/dashboard-engineer"
                        element={
                            <PrivateRoute allowedProfession="engineer">
                                <DashboardEngineer />
                            </PrivateRoute>
                        }
                    />
                    
                    <Route path="*" element={<h1>404 - Not Found</h1>} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;
