import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import RegistrationForm from './components/Registration/RegistrationForm';
import LoginForm from './components/Login/LoginForm';
import DashboardScientist from './components/Dashboard/DashboardScientist';
import DashboardEngineer from './components/Dashboard/DashboardEngineer';
import Navbar from './components/Navbar/Navbar';

function App() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [user, setUser] = useState(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const userData = localStorage.getItem('user');

        if (token && userData) {
            try {
                const parsedUser = JSON.parse(userData);
                setIsLoggedIn(true);
                setUser(parsedUser);
            } catch (error) {
                console.error("Error parsing user data from localStorage:", error);
                // Handle the error - maybe clear the localStorage or redirect to login
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                setIsLoggedIn(false);
                setUser(null);
            }
        }
    }, []);

    const handleLogin = (userData) => {
        setIsLoggedIn(true);
        setUser(userData);
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setIsLoggedIn(false);
        setUser(null);
    };

    const PrivateRoute = ({ children, allowedProfession }) => {
        if (!isLoggedIn) {
            return <Navigate to="/login" />;
        }

        if (allowedProfession && user && user.profession !== allowedProfession) {
            return <Navigate to="/dashboard" />;
        }

        return children;
    };

    return (
        <Router>
            <div>
                <Navbar isLoggedIn={isLoggedIn} onLogout={handleLogout} /> {/*  Pass handleLogout */}
                <Routes>
                    <Route path="/" element={<h1>Home Page</h1>} />
                    <Route path="/register" element={<RegistrationForm />} />
                    <Route path="/login" element={<LoginForm onLogin={handleLogin} />} />
                    <Route
                        path="/dashboard"
                        element={
                            <PrivateRoute>
                                {user?.profession === 'scientist' ? <DashboardScientist /> : null}
                                {user?.profession === 'engineer' ? <DashboardEngineer /> : null}
                                {(!user?.profession && isLoggedIn) ? <p>Please select a profession.</p> : null}
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