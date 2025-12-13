import React, { useEffect, useState } from 'react'
import SensorDataDisplayEngineer from '../SensorList/SensorDataDisplayEngineer.js'
import '../Dashboard/Dashboard.css'
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
    <div className='MenuEng'>
      <h2>Меню инженера</h2>
      <p className='leads'>
        Добро пожаловать, {nameU || 'User'}! Здесь вы можете увидеть показания датчиков вашего объекта.
      </p>
      <SensorDataDisplayEngineer />
    </div>
  )
}

export default DashboardEngineer
