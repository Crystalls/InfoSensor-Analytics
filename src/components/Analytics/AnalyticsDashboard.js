import React, { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import '../Analytics/AnalyticsDashboard.css'
import { API_BASE_URL } from '../../services/api'
import moment from 'moment'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const AnalyticsDashboard = ({ user, token }) => {
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(false)
  const [optionsLoading, setOptionsLoading] = useState(true) // Загрузка фильтров
  const [error, setError] = useState(null)

  const [assetSensorMap, setAssetSensorMap] = useState({})
  const allowedAssets = user?.access_rights?.allowedAssets || []

  const today = moment().format('YYYY-MM-DD')
  const threeDaysAgo = moment().subtract(3, 'days').format('YYYY-MM-DD')

  const [selectedAsset, setSelectedAsset] = useState(allowedAssets[0] || '')
  const [selectedSensor, setSelectedSensor] = useState('')
  const [startDate, setStartDate] = useState(threeDaysAgo)
  const [endDate, setEndDate] = useState(today)

  const fetchFilterOptions = useCallback(async () => {
    if (!token) {
      setOptionsLoading(false)
      return
    }
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } }
      const response = await axios.get(`${API_BASE_URL}/api/config/sensor-options`, config)

      const map = response.data.assetSensorMap || {}
      setAssetSensorMap(map)

      const assetsFromMap = Object.keys(map)

      if (assetsFromMap.length > 0 && !selectedAsset) {
        setSelectedAsset(assetsFromMap[0])
      }
    } catch (err) {
      console.error('Error fetching filter options:', err)
      setError('Не удалось загрузить данные для фильтров.')
    } finally {
      setOptionsLoading(false)
    }
  }, [token, selectedAsset])

  const fetchChartData = useCallback(async () => {
    if (!token || !selectedAsset || !selectedSensor || !startDate || !endDate) return

    setLoading(true)
    setError(null)

    try {
      const config = { headers: { Authorization: `Bearer ${token}` } }
      const url = `${API_BASE_URL}/api/historical-data?asset=${selectedAsset}&sensorId=${selectedSensor}&startDate=${startDate}&endDate=${endDate}`

      const response = await axios.get(url, config)
      setChartData(response.data.chartData)
    } catch (err) {
      console.error('Error fetching chart data:', err)
      setError(err.response?.data?.message || 'Ошибка загрузки данных графика.')
    } finally {
      setLoading(false)
    }
  }, [token, selectedAsset, selectedSensor, startDate, endDate])

  // Эффекты
  useEffect(() => {
    fetchFilterOptions()
  }, [fetchFilterOptions])
  useEffect(() => {
    if (selectedAsset && selectedSensor && startDate && endDate) {
      fetchChartData()
    }
  }, [fetchChartData])

  // Обработчик смены Актива
  const handleAssetChange = (newAsset) => {
    setSelectedAsset(newAsset)
    setSelectedSensor('')

    const sensors = assetSensorMap[newAsset]
    if (sensors && sensors.length > 0) {
      setSelectedSensor(sensors[0].id)
    }
  }

  const sensorsForSelectedAsset = assetSensorMap[selectedAsset] || []

  return (
    <div className='container mt-4'>
      <h1>Аналитические Графики</h1>
      <p
        className='lead text-muted'
        style={{ color: '#ff6666' }}
      >
        Анализ исторических данных. Приветствуем, {user?.nameU}!
      </p>

      {/* --- БЛОК ФИЛЬТРОВ --- */}
      <div className='p-3 mb-4 border rounded shadow-lg analytics-filter-bar'>
        {optionsLoading ? (
          // *** Скелетон для строки фильтров ***
          <div className='row g-3 align-items-end'>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className='col-md-2'
              >
                <div className='skeleton-base skeleton-label'></div>
                <div className='skeleton-base skeleton-input-bar w-100'></div>
              </div>
            ))}
          </div>
        ) : (
          // *** РАЗМЕТКА С КЛАССАМИ ---
          <div className='row g-3 align-items-end'>
            {/* Выбор Актива */}
            <div className='col-md-3'>
              <label className='form-label text-light'>Актив:</label>
              <select
                className='form-select dark-input'
                value={selectedAsset}
                onChange={(e) => handleAssetChange(e.target.value)}
                disabled={loading || Object.keys(assetSensorMap).length === 0}
              >
                {Object.keys(assetSensorMap).map((asset) => (
                  <option
                    key={asset}
                    value={asset}
                  >
                    {asset}
                  </option>
                ))}
              </select>
            </div>

            {/* Выбор Сенсора */}
            <div className='col-md-3'>
              <label className='form-label text-light'>Сенсор:</label>
              <select
                className='form-select dark-input'
                value={selectedSensor}
                onChange={(e) => setSelectedSensor(e.target.value)}
                disabled={loading || sensorsForSelectedAsset.length === 0}
              >
                {sensorsForSelectedAsset.length === 0 ? (
                  <option value=''>Нет данных сенсоров для этого актива</option>
                ) : (
                  sensorsForSelectedAsset.map((sensor) => (
                    <option
                      key={sensor.id}
                      value={sensor.id}
                    >
                      {sensor.type} ({sensor.id})
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Выбор Даты */}
            <div className='col-md-2'>
              <label className='form-label text-light'>Начальная Дата:</label>
              <input
                type='date'
                className='form-control dark-input'
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className='col-md-2'>
              <label className='form-label text-light'>Конечная Дата:</label>
              <input
                type='date'
                className='form-control dark-input'
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className='col-md-2'>
              <button
                className='btn btn-primary w-100'
                onClick={fetchChartData}
                disabled={loading || !selectedSensor || !selectedAsset}
              >
                {loading ? 'Загрузка...' : 'Обновить График'}
              </button>
            </div>
          </div>
        )}
      </div>
      {/* ----------------------------------- */}

      {error && <div className='alert alert-danger'>{error}</div>}

      <div
        className='card p-3 chart-container'
        style={{ border: 'none', height: '400px' }}
      >
        {chartData.length > 0 && !loading ? (
          <ResponsiveContainer
            width='100%'
            height='100%'
          >
            <LineChart data={chartData}>
              <CartesianGrid
                strokeDasharray='3 3'
                stroke='#444'
              />
              <XAxis
                dataKey='time'
                stroke='#ccc'
                tickFormatter={(tick) => moment(tick).format('DD.MM HH:mm')}
                interval='preserveStartEnd'
              />
              <YAxis stroke='#ccc' />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e1e24', border: '1px solid #666', color: 'white' }}
                labelFormatter={(label) => moment(label).format('YYYY-MM-DD HH:mm:ss')}
                formatter={(value) => [`${value.toFixed(3)}`, `Значение`]}
                position={{ y: -10, x: -10 }}
              />
              <Line
                type='monotone'
                dataKey='value'
                stroke='#007bff'
                strokeWidth={3}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : loading || optionsLoading ? (
          // Скелетон графика
          <div className='skeleton-chart-container p-4'>
            <div
              className='skeleton-base'
              style={{ height: '90%', width: '100%' }}
            ></div>
          </div>
        ) : (
          <p
            className='text-center text-warning'
            style={{ paddingTop: '150px' }}
          >
            Нет исторических данных для выбранных параметров. Проверьте диапазон дат.
          </p>
        )}
      </div>
    </div>
  )
}

export default AnalyticsDashboard
