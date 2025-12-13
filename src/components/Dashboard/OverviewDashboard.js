// components/Dashboard/OverviewDashboard.jsx
import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../services/api'

const OverviewDashboard = ({ user, token }) => {
  // Теперь принимает user и token
  const [stats, setStats] = useState({
    totalSensors: 0,
    activeAlerts: 0,
    lastUpdated: null,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    console.log('Token received in Overview:', token)
    const fetchStats = async () => {
      if (!token) {
        setError('Авторизационный токен отсутствует.')
        setLoading(false)
        return
      }

      try {
        // 1. СОЗДАНИЕ КОНФИГА С ТОКЕНОМ
        const config = {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }

        // 2. ПЕРЕДАЧА КОНФИГА В AXIOS
        const response = await axios.get(`${API_BASE_URL}/api/overview-stats`, config)

        // ... успешная обработка ...
        setStats(response.data)
        setLoading(false)
      } catch (err) {
        console.error('Error fetching overview stats:', err)

        // Если это 403, это ТОЧНО проблема с токеном в заголовке!
        if (err.response && err.response.status === 403) {
          setError('Доступ запрещен (403). Токен в заголовке не был принят сервером.')
        } else {
          setError('Не удалось загрузить статистику обзора.')
        }
        setLoading(false)
      }
    }

    fetchStats()
  }, [token])

  // Форматирование даты для красивого отображения
  const formatLastUpdated = (timestamp) => {
    if (!timestamp) return 'Недоступно'
    const date = new Date(timestamp)
    return date.toLocaleTimeString() + ' ' + date.toLocaleDateString()
  }

  if (loading) return <div className='container mt-4'>Загрузка общей статистики...</div>
  if (error) return <div className='alert alert-danger container mt-4'>Ошибка загрузки обзора: {error}</div>

  return (
    <div className='container mt-4'>
      <h1>Общий Обзор Системы</h1>
      <p className='lead'>
        Добро пожаловать, {user?.nameU} ({user?.profession})!
      </p>

      <div className='row mt-4'>
        <div className='col-md-4'>
          <div className='card text-center p-3 bg-light'>
            <h3>Всего Сенсоров</h3>
            <p className='display-4'>{stats.totalSensors}</p>
          </div>
        </div>
        <div className='col-md-4'>
          <div className='card text-center p-3 bg-light'>
            <h3>Активные Оповещения</h3>
            <p className={`display-4 ${stats.activeAlerts > 0 ? 'text-danger' : 'text-success'}`}>
              {stats.activeAlerts}
            </p>
          </div>
        </div>
        <div className='col-md-4'>
          <div className='card text-center p-3 bg-light'>
            <h3>Последнее Обновление</h3>
            <p className='lead text-primary'>{formatLastUpdated(stats.lastUpdated)}</p>
          </div>
        </div>
      </div>

      <h2 className='mt-5'>Сводка по Вашим Зонам Ответственности</h2>
      {/* Здесь вы можете вывести список цехов из user.access_rights.allowedSections */}
    </div>
  )
}

export default OverviewDashboard
