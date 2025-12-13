import React from 'react'
import './HomePage.css'
import serviceImage from '../../img/serviceImage.jpg' // Путь к изображению услуги
import clientsImage from '../../img/clientsImage.jpg' // Путь к изображению клиентов
import pricingImage from '../../img/pricingImage.jpg' // Путь к изображению тарифов
import contactImage from '../../img/contactImage.jpg' // Путь к изображению контактов
import 'aos/dist/aos.css' // Импортируем стили AOS
import AOS from 'aos' // Импортируем AOS

AOS.init() // Инициализируем AOS

const Home = () => {
  return (
    <div className='HomePage'>
      <div className='HomePage-header'>
        <h1>ИнфоСенсор Аналитика</h1>
        <p>Добро пожаловать в ИнфоСенсор Аналитика!</p>
      </div>
      <div className='maininfo'>
        <section data-aos='fade-up'>
          <h2>Наши Услуги</h2>
          <img
            src={serviceImage}
            alt='Услуги'
            className='section-image'
          />
          <ul>
            <li>
              <strong>Аналитика данных:</strong> Мы предоставляем мощные инструменты для анализа данных, собранных с
              ваших IoT-датчиков.
            </li>
            <li>
              <strong>Настраиваемые решения:</strong> Разработка индивидуальных решений, адаптированных под ваши
              специфические потребности.
            </li>
            <li>
              <strong>Техническая поддержка и обучение:</strong> Наша команда экспертов готова предоставить необходимую
              поддержку и обучение.
            </li>
          </ul>
          <button className='action-button'>Запросить демо</button>
        </section>
        <section data-aos='fade-up'>
          <h2>Почему выбирают нас?</h2>
          <img
            src={clientsImage}
            alt='Клиенты'
            className='section-image'
          />
          <ul>
            <li>
              <strong>Инновационные технологии:</strong> Используем современные технологии для сбора и обработки данных.
            </li>
            <li>
              <strong>Индивидуальный подход:</strong> Каждое решение разрабатывается с учетом уникальных потребностей
              вашего бизнеса.
            </li>
            <li>
              <strong>Надежность и поддержка:</strong> Мы всегда готовы помочь вам на каждом этапе сотрудничества.
            </li>
          </ul>
        </section>
        <section data-aos='fade-up'>
          <h2>Тарифные Планы</h2>
          <img
            src={pricingImage}
            alt='Тарифные планы'
            className='section-image'
          />
          <ul>
            <li>
              <strong>Базовый тариф:</strong> 250 тыс. руб. — идеален для небольших компаний.
            </li>
            <li>
              <strong>Расширенный тариф:</strong> 1 млн. руб. — подходит для средних предприятий.
            </li>
            <li>
              <strong>Премиум тариф:</strong> 3,5 млн. руб. — для крупных компаний с неограниченным количеством
              сенсоров.
            </li>
          </ul>
          <button className='action-button'>Сравнить тарифы</button>
        </section>
        <section data-aos='fade-up'>
          <h2>Свяжитесь с нами</h2>
          <img
            src={contactImage}
            alt='Контакты'
            className='section-image'
          />
          <p>
            Готовы начать? Свяжитесь с нашей командой для получения консультации или запроса демо-версии нашего
            продукта. Мы находимся в Волгоградской области и рады помочь вам!
          </p>
          <button className='action-button'>Связаться</button>
        </section>
      </div>
      <div className='footerinfo'>
        <p>
          Инвестируйте в будущее вашего бизнеса с "ИнфоСенсор Аналитика". Мы поможем вам раскрыть потенциал ваших
          данных!
        </p>
      </div>
    </div>
  )
}

export default Home
