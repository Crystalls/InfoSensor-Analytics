import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { API_BASE_URL } from '../../services/api.js'
import '../Registration/Register.css'

function RegistrationForm() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    profession: '',
    wsection: '',
    nameU: '',
  })
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const navigate = useNavigate()

  const validatePassword = (password) => {
    const errors = [] // Инициализируем массив ошибок
    if (password.length < 4) {
      errors.push('Пароль должен содержать не менее 4 символов.')
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Пароль должен содержать хотя бы одну заглавную букву.')
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Пароль должен содержать хотя бы одну строчную букву.')
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Пароль должен содержать хотя бы одну цифру.')
    }
    if (!/[^a-zA-Z0-9]/.test(password)) {
      errors.push('Пароль должен содержать хотя бы один специальный символ (например, !@#$%^&*).')
    }
    return errors // Обязательно возвращаем массив
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
    setErrors({ ...errors, [name]: '' })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrors({})
    setMessage('')

    let formErrors = {}

    if (!formData.username) {
      formErrors.username = 'Логин обязателен.'
    }
    if (!formData.email) {
      formErrors.email = 'Email обязателен.'
    } else if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(formData.email)) {
      formErrors.email = 'Неверный формат email.'
    }

    if (formData.password) {
      // Проверка, что пароль не undefined
      const passwordValidationErrors = validatePassword(formData.password)
      if (passwordValidationErrors && passwordValidationErrors.length > 0) {
        // Проверка, что массив существует и не пуст
        formErrors.password = passwordValidationErrors.join('<br>')
      }
    }

    if (formData.password !== formData.confirmPassword) {
      formErrors.confirmPassword = 'Пароли не совпадают.'
    }
    if (!formData.profession) {
      formErrors.profession = 'Профессия обязательна.'
    }
    if (!formData.wsection) {
      formErrors.wsection = 'Участок обязателен.'
    }
    if (!formData.nameU) {
      formErrors.nameU = 'Имя пользователя обязательно.'
    }

    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors)
      return
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/api/register`, formData)
      setMessage('Регистрация прошла успешно!')
      navigate('/Home')
    } catch (err) {
      console.error('Registration error:', err)
      if (err.response) {
        const backendErrors = err.response.data.errors
        if (backendErrors && Array.isArray(backendErrors)) {
          const formattedBackendErrors = {}
          backendErrors.forEach((error) => {
            formattedBackendErrors[error.path] = error.msg
          })
          setErrors(formattedBackendErrors)
        } else if (typeof err.response.data === 'string') {
          setErrors({ general: err.response.data })
        } else if (err.response.data && err.response.data.message) {
          setErrors({ general: err.response.data.message })
        } else {
          setErrors({ general: 'Неизвестная ошибка от сервера' })
        }
      } else {
        setErrors({ general: 'Ошибка сети или сервера.' })
      }
    }
  }

  return (
    <div className='register-container'>
      <h2 className='register-title'>Регистрация</h2>
      {message && <p className='error-message'>{message}</p>}
      {errors.general && <p className='error-message'>{errors.general}</p>}
      <form onSubmit={handleSubmit}>
        <div className='register-form'>
          <div className='form-group'>
            <label htmlFor='username'>Логин:</label>
            <input
              className='form-input'
              type='text'
              id='username'
              name='username'
              value={formData.username}
              onChange={handleChange}
            />
            {errors.username && <p className='error-message'>{errors.username}</p>}
            <label htmlFor='email'>Email:</label>
            <input
              className='form-input'
              type='email'
              id='email'
              name='email'
              value={formData.email}
              onChange={handleChange}
            />
            {errors.email && <p className='error-message'>{errors.email}</p>}
            <label htmlFor='password'>Пароль:</label>
            <input
              className='form-input'
              type='password'
              id='password'
              name='password'
              value={formData.password}
              onChange={handleChange}
            />
            {errors.password && <p className='error-message'>{errors.password}</p>}
            <label htmlFor='confirmPassword'>Подтвердите Пароль:</label>
            <input
              className='form-input'
              type='password'
              id='confirmPassword'
              name='confirmPassword'
              value={formData.confirmPassword}
              onChange={handleChange}
            />
            {errors.confirmPassword && <p className='error-message'>{errors.confirmPassword}</p>}
            <label htmlFor='profession'>Профессия:</label>
            <select
              className='form-input'
              id='profession'
              name='profession'
              value={formData.profession}
              onChange={handleChange}
            >
              <option value=''>Выберите профессию</option>
              <option value='scientist'>Ученый</option>
              <option value='engineer'>Инженер</option>
            </select>
            {errors.profession && <p className='error-message'>{errors.profession}</p>}
            <label htmlFor='wsection'>Рабочий участок:</label>
            <input
              className='form-input'
              type='text'
              id='wsection'
              name='wsection'
              value={formData.wsection}
              onChange={handleChange}
            />
            {errors.wsection && <p className='error-message'>{errors.wsection}</p>}
            <label htmlFor='nameU'>Отображаемое имя:</label>
            <input
              className='form-input'
              type='text'
              id='nameU'
              name='nameU'
              value={formData.nameU}
              onChange={handleChange}
            />
            {errors.nameU && <p className='error-message'>{errors.nameU}</p>}
          </div>
        </div>

        <button
          type='submit'
          className='submit-button-register-glow'
        >
          Зарегистрироваться
        </button>
      </form>
    </div>
  )
}

export default RegistrationForm
