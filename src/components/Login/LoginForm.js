import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios' // Import axios
import { API_BASE_URL } from '../../services/api.js' // Assuming you have an API base URL
import './Login.css'

function LoginForm({ onLogin }) {
  //  Receive onLogin function
  const [loginIdentifier, setLoginIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    try {
      console.log('Sending to /login:', { loginIdentifier, password })
      const response = await axios.post(`${API_BASE_URL}/login`, {
        // API Endpoint
        loginIdentifier: loginIdentifier,
        password,
      })

      if (response.status === 200) {
        // Successful login
        // Assuming your backend returns a token and user details
        const { token, user } = response.data

        // Store user data

        console.log('Login successful. Stored user:', user) // Add log

        user?.profession === 'engineer' && onLogin(token, user) //  Call onLogin function to update app state

        navigate('/dashboard-engineer') //  Redirect to dashboard

        user?.profession === 'scientist' && onLogin(token, user) //  Call onLogin function to update app state

        navigate('/dashboard-scientist') //  Redirect to dashboard
      } else {
        setError(response.data.message || 'Login failed') // Handle error messages
      }
    } catch (err) {
      setError('Недействительные учетные данные!')
      console.error('Login error:', err)
    }
  }

  return (
    <div className='login-container'>
      <h2 className='login-title'>Вход</h2>
      {error && <p className='error-message'>{error}</p>}
      <form onSubmit={handleSubmit}>
        <div className='login-form'>
          <div className='form-group'>
            <label htmlFor='username'>Логин или почта:</label>
            <input
              className='form-input'
              type='text'
              id='loginIdentifier'
              value={loginIdentifier}
              onChange={(e) => setLoginIdentifier(e.target.value)}
              required
            />
            <label htmlFor='password'>Пароль:</label>
            <input
              className='form-input'
              type='password'
              id='password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </div>
        <div className='buttons'>
          <button
            type='submit'
            className='submit-button'
          >
            Войти
          </button>
          <button
            type='submit'
            className='forgot-button'
          >
            Забыли пароль?
          </button>
        </div>
      </form>
    </div>
  )
}

export default LoginForm
