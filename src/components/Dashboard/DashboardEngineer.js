import React, { useEffect, useState } from 'react'
import SensorDataDisplayEngineer from '../SensorList/SensorDataDisplayEngineer.js'
import '../Dashboard/Dashboard.css'
import { API_BASE_URL } from '../../services/api.js' // Assuming you have an API base URL

function DashboardEngineer({ user }) {
  return (
    <div className='MenuEng'>
      <h2>Меню инженера</h2>
      <p className='leads'>
        Добро пожаловать, {user?.nameU}! Здесь вы можете увидеть показания датчиков вашего рабочего сектора.
      </p>
      <SensorDataDisplayEngineer />
    </div>
  )
}

export default DashboardEngineer
