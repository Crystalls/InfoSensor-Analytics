import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import '../Navbar/Navbar.css'
import logo from '../../img/logo.png'

function Navbar({ isLoggedIn, onLogout, title }) {
  const navigate = useNavigate()

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user') // Remove user data
    onLogout()
    navigate('/login')
  }

  return (
    <header className='header'>
      <div className='header_cont'>
        <div className='Logo'>
          <img
            src={logo}
            alt='Logo'
            className='LogoHeader'
          />
        </div>
        <div className='links'>
          <ul>
            <li>
              <Link to='/'>Home</Link>
            </li>
            <li>
              <Link to='/'>Home</Link>
            </li>
            <li>
              <Link to='/'>Home</Link>
            </li>
            <li>
              <Link to='/'>Home</Link>
            </li>
            <li>
              <Link to='/'>Home</Link>
            </li>
            {isLoggedIn && (
              <>
                <li>
                  <Link to='/dashboard'>Dashboard</Link>
                </li>
              </>
            )}
          </ul>
        </div>
        <div className='login_links'>
          <ul>
            {!isLoggedIn && (
              <>
                <li>
                  <Link to='/register'>Register</Link>
                </li>
                <li>
                  <Link to='/login'>Login</Link>
                </li>
              </>
            )}
            {isLoggedIn && (
              <>
                <li>
                  <button
                    className='logout_btn'
                    onClick={handleLogout}
                  >
                    Logout
                  </button>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </header>
  )
}

export default Navbar
