import React, { useEffect, useState } from 'react';
import SensorDataDisplay from '../SensorList/SensorDataDisplay';
import { API_BASE_URL } from '../../services/api.js'; // Assuming you have an API base URL

function DashboardScientist() {

    const [username, setUsername] = useState(null);

    useEffect(() => {
        //Получение имени пользователя из БД, после входа
        const storedName = localStorage.getItem('username');

        if (storedName) {
            setUsername(storedName);
        }
    }, []);

    return (
        <div>
            <h2>Scientist Dashboard</h2>
            <p>Welcome, {username || 'User'}!  Here you can see your agricultural sensor data.</p>
            <SensorDataDisplay />
        </div>
    );
}

export default DashboardScientist;