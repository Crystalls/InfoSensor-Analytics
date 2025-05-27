// SensorDataDisplay.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../services/api'; // Assuming you have an API base URL
import '../SensorList/SensorList.css';

function TemperatureDisplay({ temperature }) {
    return (
        <span>{temperature} °C</span>
    );
}

function SensorDataDisplay() {
    const [sensorData, setSensorData] = useState([]);
    const [isLoading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchSensorData = async () => {
            setLoading(true);
            setError('');
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    setError('No token found. Please log in.');
                    return;
                }

                const response = await axios.get(`${API_BASE_URL}/sensor-data`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });

                setSensorData(response.data);
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to fetch sensor data');
                console.error("Error fetching sensor data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchSensorData();
    }, []);

    if (isLoading) {
        return <p>Loading sensor data...</p>;
    }

    if (error) {
        return <p style={{ color: 'red' }}>Error: {error}</p>;
    }

    return (
        <div>
            <h2>Sensor Data</h2>
            {sensorData.length > 0 ? (
                <ul>
                    {sensorData.map(data => (
                        <li key={data._id}>
                            ID Датчика: {data.sensor_id}, 
                            Температура: <TemperatureDisplay temperature={data.temperature} />, 
                            Дата замера: {new Date(data.timestamp).toLocaleString()},
                            Влажность: {data.humidity} %,
                            Культура: {data.crop_type}
                        </li>
                    ))}
                </ul>
            ) : (
                <p>No sensor data available.</p>
            )}
        </div>
    );
}

export default SensorDataDisplay;