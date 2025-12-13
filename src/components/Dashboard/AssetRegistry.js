// components/Dashboard/AssetRegistry.jsx
import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../services/api'

const AssetRegistry = ({ user, token }) => {
  // Получаем user и token для запросов
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchAssets = async () => {
      try {
        // Устанавливаем токен в заголовки для авторизации
        const config = {
          headers: { Authorization: `Bearer ${token}` },
        }

        const response = await axios.get(`${API_BASE_URL}/api/assets`, config)

        // response.data будет { allowedSections: [...], availableAssets: [...] }
        setAssets(response.data.availableAssets || [])
        setLoading(false)
      } catch (err) {
        console.error('Error fetching asset registry:', err)
        setError('Не удалось загрузить реестр активов. Проверьте права доступа.')
        setLoading(false)
      }
    }

    if (token) {
      fetchAssets()
    }
  }, [token])

  if (loading) return <div>Загрузка реестра активов...</div>
  if (error) return <div className='alert alert-danger'>Ошибка: {error}</div>
  if (assets.length === 0)
    return <div className='alert alert-info'>У вас нет зарегистрированных активов для управления.</div>

  return (
    <div className='container mt-4'>
      <h1>Реестр Активов (Инженер)</h1>
      <p>Просмотр и управление оборудованием, доступным Вам по праву доступа.</p>

      <table className='table table-striped'>
        <thead>
          <tr>
            <th>#</th>
            <th>Название Актива</th>
            <th>Цех</th>
            <th>Статус</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((assetName, index) => (
            <tr key={index}>
              <td>{index + 1}</td>
              <td>
                <strong>{assetName}</strong>
              </td>
              <td>{user?.wsection || 'N/A'}</td> {/* Используем wsection из токена */}
              <td className='text-success'>Активен</td>
              <td>
                <button className='btn btn-sm btn-outline-primary me-2'>Детали</button>
                {/* Кнопка редактирования, доступная только инженеру */}
                <button className='btn btn-sm btn-warning'>Ред.</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className='btn btn-success mt-3'>Добавить Новый Актив</button>
    </div>
  )
}

export default AssetRegistry
