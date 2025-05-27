// SensorDataDisplay.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../services/api'; // Assuming you have an API base URL
import AlertValue from '../AlertList/AlertList';
import '../SensorList/SensorList.css';

function TemperatureDisplay({ temperature }) {
    return (
        <span>{temperature} °C</span>
    );
}



function SensorDataDisplayEngineer() {
    const [sensorData, setSensorData] = useState([]);
    const [isLoading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const temperatureThreshold = 45;
    const humidityThreshold = 65;

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
                    {sensorData.map(data => {
                        let alertThreshold, alertMessage;

                        if (data.sensor_type.toLowerCase().includes('температур')) {
                            alertThreshold = temperatureThreshold;
                            alertMessage = `Превышены пороговые значения для температуры`;
                        } else if (data.sensor_type.toLowerCase().includes('влажн')) {
                            alertThreshold = humidityThreshold;
                            alertMessage = `Превышены пороговые значения для влажности`;
                        } else {
                            alertThreshold = 200;  // Default threshold
                            alertMessage = `Превышены пороговые значения для ${data.sensor_type.toLowerCase()}`;
                        }

                        return (
                            
                            <li key={data._id}>
                                <div className='Sensor_container'>
                                    <div className='text_sensors'>
                                        ID Датчика: {data.sensor_id},
                                        <br></br>
                                        Тип датчика: {data.sensor_type.toLowerCase()},
                                        <br></br>
                                        Показатели: <AlertValue
                                            sensorType={data.sensor_type}
                                            value={data.value} // value не складывается с unit, выносим unit в AlertValue
                                            alertThreshold={alertThreshold}
                                            alertMessage={alertMessage}
                                            unit={data.unit}  // передаем unit как отдельный prop
                                        />
                                        Дата замера: {new Date(data.timestamp).toLocaleString()}
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <p>No sensor data available.</p>
            )}
        </div>
    );
}

export default SensorDataDisplayEngineer;