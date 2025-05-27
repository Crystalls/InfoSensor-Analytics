import React, { useEffect, useState } from 'react';
import SensorDataDisplayEngineer from '../SensorList/SensorDataDisplayEngineer.js';
import { API_BASE_URL } from '../../services/api.js'; // Assuming you have an API base URL

function DashboardEngineer() {

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
            <h2>Engineer Dashboard</h2>
            <p>Welcome, {username || 'User'}!  Here you can see your machine sensor data.</p>
            <SensorDataDisplayEngineer />
        </div>
    );
}

export default DashboardEngineer;