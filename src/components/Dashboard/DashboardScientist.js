import React, { useEffect, useState } from 'react'
import SensorDataDisplay from '../SensorList/SensorDataDisplayScientist.js'
import { API_BASE_URL } from '../../services/api.js' // Assuming you have an API base URL
import SensorDataDisplayScientist from '../SensorList/SensorDataDisplayScientist.js'

function DashboardScientist({ user }) {
  return (
    <div className='MenuEng'>
      <h2>Меню ученого</h2>
      <p className='leads'>
        Добро пожаловать, {user?.nameU}! Здесь вы можете увидеть показания датчиков вашего рабочего сектора.
      </p>
      <SensorDataDisplayScientist />
    </div>
  )
}

export default DashboardScientist
