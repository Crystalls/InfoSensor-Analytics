import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios'; // Import axios
import { API_BASE_URL } from '../../services/api.js'; // Assuming you have an API base URL

function RegistrationForm() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [email, setEmail] = useState('');
    const [profession, setProfession] = useState(''); // Выбор профессии
    const [wsection, setWsection] = useState('')
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        
        try {
            const response = await axios.post(`${API_BASE_URL}/register`, { //  API Endpoint
                username,
                email,
                password,
                profession,
                wsection,
            });

            if (response.status === 201) { //  Successful registration
                alert('Registration successful!');
                navigate('/login'); // Redirect to login page
            } else {
                
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Network error or server error');
            console.error("Registration error:", err);
        }
    };

    return (
        <div>
            <h2>Registration</h2>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <form onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="username">Логин:</label>
                    <input type="text" id="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
                </div>
                <div>
                    <label htmlFor="email">Email:</label>
                    <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div>
                    <label htmlFor="password">Пароль:</label>
                    <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <div>
                    <label htmlFor="profession">Профессия:</label>
                    <select id="profession" value={profession} onChange={(e) => setProfession(e.target.value)} required>
                        <option value="">Select Profession</option>
                        <option value="scientist">Scientist</option>
                        <option value="engineer">Engineer</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="profession">Рабочий участок:</label>
                    <input type="text" id="wsection" value={wsection} onChange={(e) => setWsection(e.target.value)} required />
                </div> 

                <button type="submit">Register</button>
            </form>
        </div>
    );
}

console.log(__dirname)

export default RegistrationForm;