import React, { useEffect, useState } from 'react'
import SensorDataDisplayEngineer from '../SensorList/SensorDataDisplayEngineer.js'
import { API_BASE_URL } from '../../services/api.js' // Assuming you have an API base URL

function DashboardEngineer() {
  const [nameU, setNameU] = useState(null)

  useEffect(() => {
    //Получение имени пользователя из БД, после входа
    const storedName = localStorage.getItem('nameU')

    if (storedName) {
      setNameU(storedName)
    }
  }, [])

  return (
    <div>
      <h2>Engineer Dashboard</h2>
      <p>Welcome, {nameU || 'User'}! Here you can see your machine sensor data.</p>
      <SensorDataDisplayEngineer />
    </div>
  )
}

export default DashboardEngineer
