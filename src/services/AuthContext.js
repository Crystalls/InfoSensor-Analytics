import React, { createContext, useState, useEffect, useContext, useCallback } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../services/api' // Убедитесь, что ваш API_BASE_URL настроен

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('token')) // Пытаемся получить токен из localStorage
  const [isLoading, setIsLoading] = useState(true) // Для отслеживания первой проверки

  // Функция для логина
  const login = useCallback(async (loginIdentifier, password) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/login`, { loginIdentifier, password })
      const { token: newToken, user: userData } = response.data

      localStorage.setItem('token', newToken) // Сохраняем токен
      setToken(newToken)
      setUser(userData) // Сохраняем данные пользователя

      return true // Успешный логин
    } catch (error) {
      console.error('Login error:', error)
      throw error // Возвращаем ошибку для обработки во фронтенде
    }
  }, [])

  // Функция для логаута
  const logout = useCallback(() => {
    localStorage.removeItem('token') // Удаляем токен
    setToken(null)
    setUser(null)
  }, [])

  // Функция для первой проверки аутентификации при загрузке приложения
  const checkAuth = useCallback(async () => {
    const storedToken = localStorage.getItem('token')
    if (!storedToken) {
      setIsLoading(false)
      return
    }

    try {
      // Попробуем проверить токен на сервере (опционально, но безопасно)
      // Например, можно сделать GET-запрос к `/me` или `/user`
      // Если такой эндпоинт есть, он должен вернуть информацию о текущем пользователе
      // Если эндпоинта нет, можно просто установить пользователя и токен

      // Для примера: Если у вас есть эндпоинт, который возвращает данные пользователя по токену
      // const response = await axios.get(`${API_BASE_URL}/user`, {
      //     headers: { Authorization: `Bearer ${storedToken}` }
      // });
      // setUser(response.data);

      // Если нет такого эндпоинта, но вы доверяете токену, можно просто установить:
      setToken(storedToken)
      // Для установки пользователя, вы можете декодировать токен на фронтенде,
      // но более безопасно получить его с сервера.
      // Если у вас есть возможность получить user info из токена (например, в JWT Payload)
      // вы можете попробовать установить user, но это менее надежно, чем запрос на сервер.
      // В данном примере, предположим, что при логине мы сохраняем user info (что не очень безопасно)
      // Или же, что у вас есть /user эндпоинт.

      // Если просто хотим проверить, что токен есть и валиден (без запроса к /user):
      // Можно просто установить токен. При первом реальном запросе к защищенным роутам,
      // сервер проверит токен.

      // В данном примере, я предполагаю, что токен хранится, и при первом запуске
      // мы просто устанавливаем его, чтобы защищенные роуты могли работать.
      // Если у вас есть эндпоинт `/user` или `/me`, используйте его!

      // --- УПРОЩЕННАЯ ВЕРСИЯ (ПРЕДПОЛАГАЯ, ЧТО JWT СОДЕРЖИТ ВСЕ НЕОБХОДИМОЕ) ---
      // Для установки пользователя, если вы не делаете запрос к /user,
      // но знаете, что токен содержит информацию о пользователе:
      try {
        const payload = JSON.parse(atob(storedToken.split('.')[1])) // Декодируем payload JWT
        setUser({
          id: payload.userId,
          username: payload.username,
          profession: payload.profession,
          wsection: payload.wsection,
          nameU: payload.nameU,
          // ... остальные поля из JWT
        })
      } catch (e) {
        console.error('Failed to decode JWT payload', e)
        // Если декодирование не удалось, оставим user null, но токен будет установлен
      }
      // --- КОНЕЦ УПРОЩЕННОЙ ВЕРСИИ ---
    } catch (error) {
      console.error('Auth check failed:', error)
      logout() // Если проверка не прошла, выходим
    } finally {
      setIsLoading(false) // Завершили первую проверку
    }
  }, [logout]) // Зависимость от logout

  useEffect(() => {
    checkAuth()
  }, [checkAuth]) // Выполняем проверку при первом монтировании

  // Предоставляем значения через контекст
  const value = {
    user,
    token,
    login,
    logout,
    isAuthenticated: !!token && !!user, // Проверяем наличие токена и пользователя
    isLoadingAuth: isLoading, // Флаг, показывающий, идет ли первая проверка
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Хук для удобного доступа к контексту
export const useAuth = () => useContext(AuthContext)
