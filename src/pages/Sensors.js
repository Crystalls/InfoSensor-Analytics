import React, { useState, useEffect } from 'react';
import sensorService from '../api/sensorService'; // Import the mock API
import SensorList from '../components/SensorList/SensorList';

function Sensors() {
  const [sensors, setSensors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSensors = async () => {
      try {
        const data = await sensorService.getSensors();
        setSensors(data);
      } catch (error) {
        console.error('Error fetching sensors:', error);
        // Handle error (e.g., display an error message)
      } finally {
        setLoading(false);
      }
    };

    fetchSensors();
  }, []);

  if (loading) {
    return <p>Loading sensors...</p>;
  }

  return (
    <div>
      <h2>Sensor List</h2>
      <SensorList sensors={sensors} />
    </div>
  );
}

export default Sensors;