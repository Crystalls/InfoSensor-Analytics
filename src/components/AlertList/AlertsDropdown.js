import React, { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../services/api'
import moment from 'moment'
import { toast, ToastContainer } from 'react-toastify'
require('moment/locale/ru')

const AlertsDropdown = ({ token }) => {
  const [alerts, setAlerts] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const intervalRef = useRef(null)
  // Ref для хранения ID тревог, которые уже были показаны пользователю
  const seenAlertIdsRef = useRef(new Set())

  // --- 1. ФУНКЦИЯ ЗАГРУЗКИ (Polling) ---
  const fetchAlerts = useCallback(async () => {
    if (!token) return
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } }
      const response = await axios.get(`${API_BASE_URL}/api/alerts/active`, config)
      const newAlertsData = response.data.activeAlerts
      setUnreadCount(response.data.unreadCount)

      console.log('--- FRONTEND DEBUG ---')
      console.log('Active Alerts from API:', newAlertsData)
      console.log('Unread Count:', response.data.unreadCount)

      const newlyActiveAlerts = newAlertsData.filter(
        (alert) =>
          // 1. Это новый alert (его ID нет в нашем "виденном" списке)
          !seenAlertIdsRef.current.has(alert._id) &&
          // 2. Он непрочитанный (чтобы не показывать старые, которые были проигнорированы)
          !alert.isRead &&
          // 3. Он не решен
          !alert.resolvedBy,
      )

      if (newlyActiveAlerts.length > 0) {
        newlyActiveAlerts.forEach((alert) => {
          // Показываем уведомление
          toast.error(`ТРЕВОГА: [${alert.sensor_id}] ${alert.message}`, {
            position: 'top-right',
            autoClose: 5000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
          })
          // Добавляем ID в список "виденных"
          seenAlertIdsRef.current.add(alert._id)
        })
      }

      setAlerts(newAlertsData)
      newAlertsData.forEach((alert) => seenAlertIdsRef.current.add(alert._id))
    } catch (error) {
      console.error('Failed to fetch alerts:', error)
    }
  }, [token])

  // --- 2. УПРАВЛЕНИЕ POLLING ИНТЕРВАЛОМ ---
  useEffect(() => {
    // Запускаем первый запрос сразу
    fetchAlerts()

    // Устанавливаем интервал (например, каждые 15 секунд)
    intervalRef.current = setInterval(fetchAlerts, 15000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [fetchAlerts])

  // --- 3. ФУНКЦИИ ДЕЙСТВИЙ ---

  const markAsRead = async (id) => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } }
      await axios.put(`${API_BASE_URL}/api/alerts/${id}/read`, {}, config)
      // Обновляем список локально или через новый запрос
      fetchAlerts()
    } catch (error) {
      console.error('Failed to mark alert as read:', error)
    }
  }

  const resolveAlert = async (id) => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } }
      await axios.put(`${API_BASE_URL}/api/alerts/${id}/resolve`, {}, config)
      fetchAlerts() // Обновляем список, чтобы скрыть решенное
    } catch (error) {
      console.error('Failed to resolve alert:', error)
    }
  }

  const toggleDropdown = () => {
    setDropdownOpen((prev) => !prev)
    // При открытии, помечаем все непрочитанные как прочитанные (опционально)
    alerts.filter((a) => !a.isRead).forEach((a) => markAsRead(a._id))
  }

  return (
    // Используем стандартный Dropdown контейнер
    <div className={`dropdown ${dropdownOpen ? 'show' : ''}`}>
      <button
        className='btn btn-dark position-relative'
        type='button'
        onClick={toggleDropdown}
        // Используем inline-стиль для прозрачности кнопки
        style={{ border: 'none', backgroundColor: 'transparent', padding: '0.375rem 0.75rem' }}
      >
        <i className='fas fa-bell text-warning'></i>
        {unreadCount > 0 && (
          <span className='position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger'>
            {unreadCount}
          </span>
        )}
      </button>

      {/* --- DROP-DOWN MENU (Используем Bootstrap для позиционирования) --- */}
      <div
        // Классы Bootstrap: dropdown-menu-end для привязки справа
        className={`dropdown-menu dropdown-menu-end shadow ${dropdownOpen ? 'show' : ''}`}
        style={{
          width: '500px',
          backgroundColor: '#1e1e1e', // Темный фон
          border: '1px solid #444',
          maxHeight: '400px',
          overflowY: 'auto',
          right: '0',
          transform: 'translateX(0)', // Сбрасываем возможные конфликты
          marginLeft: 'auto',
          marginRight: '10px', // Отступ от правого края окна (если нет контейнера)
        }}
      >
        {/* ЗАГОЛОВОК */}
        <h6
          className='dropdown-header text-warning'
          style={{ borderBottom: '1px solid #444', padding: '10px 15px' }}
        >
          Активные Тревоги ({alerts.length})
        </h6>

        <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
          {alerts.length === 0 ? (
            <p
              className='p-3 text-muted text-center'
              style={{ fontSize: '0.9rem' }}
            >
              Нет активных тревог.
            </p>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert._id}
                // Используем классы d-flex и text-white для содержимого
                className={`dropdown-item d-flex flex-column text-white`}
                style={{
                  borderBottom: '1px solid #333',
                  padding: '10px 15px',
                  backgroundColor: !alert.isRead ? '#303030' : 'transparent', // Фон для непрочитанных
                  lineHeight: '1.4',
                }}
              >
                <div className='d-flex justify-content-between align-items-start w-100'>
                  {/* Сообщение */}
                  <div
                    style={{ fontWeight: !alert.isRead ? 'bold' : 'normal', fontSize: '0.9rem', marginRight: '5px' }}
                  >
                    {`[${alert.sensor_id}] ${alert.message}`}
                  </div>
                  {/* Время */}
                  <small
                    className='text-muted ms-2'
                    style={{ whiteSpace: 'nowrap', fontSize: '0.75rem' }}
                  >
                    {moment(alert.timestamp).locale('ru').fromNow()}
                  </small>
                </div>

                {/* КНОПКА РЕШИТЬ / СТАТУС */}
                <div className='mt-2 d-flex justify-content-end w-100'>
                  {!alert.resolvedBy ? (
                    <button
                      className='btn btn-sm btn-outline-success py-0 px-2'
                      onClick={(e) => {
                        e.stopPropagation()
                        resolveAlert(alert._id)
                      }}
                      style={{ fontSize: '0.7rem' }}
                    >
                      Решить
                    </button>
                  ) : (
                    <small
                      className='text-success'
                      style={{ fontSize: '0.8rem' }}
                    >
                      Решено: {alert.resolvedBy}
                    </small>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div
          className='dropdown-divider'
          style={{ backgroundColor: '#444' }}
        ></div>
        <a
          href='/notifications'
          className='dropdown-item text-center text-info'
          style={{ backgroundColor: 'transparent', padding: '10px 15px' }}
        >
          Перейти ко всем уведомлениям
        </a>
      </div>
    </div>
  )
}

export default AlertsDropdown
