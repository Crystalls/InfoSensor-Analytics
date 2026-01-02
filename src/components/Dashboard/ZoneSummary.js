import React, { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../services/api'

const POLLING_INTERVAL_MS = 10000

const ZoneSummary = ({ token }) => {
  const [summaryData, setSummaryData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchSummary = useCallback(async () => {
    if (!token) return
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } }
      const response = await axios.get(`${API_BASE_URL}/api/user-zone-summary`, config)

      setSummaryData(response.data.summary)
    } catch (err) {
      console.error('Error fetching zone summary:', err)
      if (summaryData.length === 0) {
        setError('Не удалось загрузить сводку по зонам.')
      }
    } finally {
      setLoading(false)
    }
  }, [token, summaryData.length])

  useEffect(() => {
    fetchSummary()
    const intervalId = setInterval(fetchSummary, POLLING_INTERVAL_MS)
    return () => clearInterval(intervalId)
  }, [fetchSummary])

  if (loading && summaryData.length === 0) return <p className='text-center'>Загрузка сводки по зонам...</p>
  if (error) return <div className='alert alert-danger text-center'>{error}</div>
  if (summaryData.length === 0) return <p className='text-center text-muted'>У вас нет зон ответственности.</p>

  return (
    <div className='row mt-4'>
      {summaryData.map((zone, index) => (
        <div
          key={index}
          className='col-lg-4 col-md-6 mb-4'
        >
          <div
            className='card h-100 border-0 shadow-lg'
            style={{ backgroundColor: '#3a3a43' }}
          >
            <div className='card-header bg-dark'>
              <h4 className='mb-0 text-white'>{zone.assetName}</h4>
            </div>
            <div className='card-body text-light'>
              <p className='text-muted mb-1'>Цех: {zone.workshop}</p>

              <hr />

              <h5 className={`text-center ${zone.statusColor}`}>{zone.status}</h5>
              <p className='text-center'>
                ({zone.alarmSensors} из {zone.totalSensors} под угрозой)
              </p>

              <hr />

              <p className='card-text small'>
                Последнее чтение: {zone.lastReading} ({zone.lastUpdated})
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default ZoneSummary
