import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation } from 'swiper/modules';
import { getTips } from '../services/api';
import { toast } from 'react-hot-toast';
import 'swiper/css';
import 'swiper/css/navigation';
import '../styles/Tips.css';
let mainTip;

const Tips = () => {
  const [tips, setTips] = useState([]);
  const [currentTip, setCurrentTip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hiddenSlides, setHiddenSlides] = useState([]);
  
  const prevRef = useRef(null);
  const nextRef = useRef(null);
  const swiperRef = useRef(null);

  useEffect(() => {
    fetchTips();
  }, []);

  useEffect(() => {
    if (currentTip) {
      const root = document.getElementById('hero');
      if (root) {
        root.style.backgroundImage = `url('${currentTip.image}')`;
        root.style.backgroundSize = 'cover';
        root.style.backgroundPosition = 'center';
      }
    }
  }, [currentTip]);

  const fetchTips = async () => {
    try {
      setLoading(true);
      let data = await getTips();
      mainTip = data.shift();
      setTips(data);
      if (mainTip) {
        setCurrentTip(mainTip);
      }
      setError(null);
    } catch (err) {
      setError('Failed to load tips');
      toast.error('Failed to load tips');
      console.error('Error fetching tips:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSlideChange = (swiper) => {
    const realIndex = swiper.realIndex;
    console.log(realIndex)
    const newTip = realIndex - 1 === -1 ? mainTip : tips[realIndex - 1];
    console.log(newTip);
    setCurrentTip(newTip);
    
    const newHiddenSlides = [];
    for (let i = 0; i < swiper.slides.length; i++) {
      if (i < realIndex) {
        newHiddenSlides.push(i);
      }
    }
    
    setHiddenSlides(newHiddenSlides);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      </div>
    );
  }

  // Limit tips for non-authenticated users
  const displayedTips = tips;

  return (
    <div className="tips-wrapper">
      <div id="hero" className="hero d-flex justify-content-between align-items-end">
        {currentTip && (
          <div className="hero-content mb-5">
            <h1 className="tip-title text-right">{currentTip.title}</h1>
            <p className="tip-text text-left">{currentTip.text}</p>
            <a href={currentTip.link} className="tip-link" target="_blank" rel="noopener noreferrer">
              Discover Now
            </a>
          </div>
        )}

        <div className="swiper-block">
          <Swiper
            modules={[Navigation]}
            slidesPerView={5}
            spaceBetween={20}
            centeredSlides={true}
            loop={false}
            navigation={{
              prevEl: prevRef.current,
              nextEl: nextRef.current
            }}
            onBeforeInit={(swiper) => {
              swiper.params.navigation.prevEl = prevRef.current;
              swiper.params.navigation.nextEl = nextRef.current;
              swiperRef.current = swiper;
            }}
            onSlideChange={handleSlideChange}
            initialSlide={0}
          >
            {displayedTips.map((tip, index) => (
              <SwiperSlide
                key={tip._id}
                className={`tip-slide ${hiddenSlides.includes(index) ? 'hidden-slide' : ''}`}
                style={{ 
                  backgroundImage: `url('${tip.image}')`,
                  opacity: hiddenSlides.includes(index) ? 0.3 : 1,
                  transform: hiddenSlides.includes(index) ? 'scale(0.9)' : 'scale(1)'
                }}
              ></SwiperSlide>
            ))}
            <SwiperSlide style={{ opacity: 0 , 
                  boxShadow: 'none'}}>
            </SwiperSlide>
          </Swiper>
          <div className="swiper-nav">
            <div ref={prevRef} className="swiper-button-prev visible-button"></div>
            <div ref={nextRef} className="swiper-button-next visible-button"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tips;