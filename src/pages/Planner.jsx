import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Chart from 'chart.js/auto';
import html2pdf from 'html2pdf.js';
import { toast } from 'react-hot-toast';
import { savePlannerEntry, getPlannerHistory } from '../services/api';
import AOS from 'aos';
import 'aos/dist/aos.css';
import '../styles/Planner.css';

function Planner() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [user, setUser] = useState(null);
  const [plannerHistory, setPlannerHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [expenses, setExpenses] = useState({
    charity: 0,
    food: 0,
    housing: 0,
    utilities: 0,
    maintenance: 0,
    transportation: 0,
    education: 0,
    entertainment: 0,
    debt: 0,
    health: 0,
    savings: 0,
    others: 0
  });
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [insights, setInsights] = useState(null);
  const [error, setError] = useState('');

  // Chart refs
  const budgetChartRef = useRef(null);
  const comparisonChartRef = useRef(null);
  const yearlyChartRef = useRef(null);
  const downloadBtnRef = useRef(null);
  
  // Chart canvas refs
  const budgetCanvasRef = useRef(null);
  const comparisonCanvasRef = useRef(null);
  const yearlyCanvasRef = useRef(null);

  useEffect(() => {
    AOS.init({
      duration: 1000,
      once: true
    });

    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
      fetchPlannerHistory();
    }

    return () => {
      destroyCharts();
    };
  }, []);

  useEffect(() => {
    updateBudgetChart();
  }, [monthlyIncome, expenses]);

  useEffect(() => {
    const total = Object.values(expenses).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    if (total > monthlyIncome) {
      setError('Total expenses exceed your salary!');
    } else {
      setError('');
    }
  }, [monthlyIncome, expenses]);

  useEffect(() => {
    if (showAnalysis) {
      requestAnimationFrame(() => {
        updateAnalysisCharts();
        generateInsights();
      });
    } else {
      destroyAnalysisCharts();
      setInsights(null);
    }
  }, [showAnalysis]);

  const fetchPlannerHistory = async () => {
    try {
      const data = await getPlannerHistory();
      setPlannerHistory(data);
    } catch (error) {
      console.error('Error fetching history:', error);
      toast.error('Failed to load planning history');
    }
  };

  const generateInsights = () => {
    // 1) compute totals
    const obligationsCategories = ['housing','transportation','debt','health','education','maintenance','utilities'];
    const personalCategories    = ['others','entertainment','charity','food'];
    const investmentCategories  = ['savings'];

    const actual = {
      obligations: obligationsCategories.reduce((s,cat)=> s + (expenses[cat]||0), 0),
      personal:    personalCategories.reduce((s,cat)=> s + (expenses[cat]||0), 0),
      investment:  investmentCategories.reduce((s,cat)=> s + (expenses[cat]||0), 0)
    };

    const totalExpenses = Object.values(expenses)
      .reduce((sum,v)=> sum + (parseFloat(v)||0), 0);

    // 2) pick rule based on totalExpenses
    let ideal = { obligations:0, personal:0, investment:0 };
    let mainMessage = '';

    if (totalExpenses > monthlyIncome) {
      mainMessage = t('planner.insights.main_messages.over_budget');
    }
    else if (totalExpenses <= monthlyIncome / 3) {
      ideal = {
        obligations: monthlyIncome/3,
        personal:    monthlyIncome/3,
        investment:  monthlyIncome/3
      };
      mainMessage = t('planner.insights.main_messages.one_third_rule');
    }
    else if (totalExpenses <= monthlyIncome / 2) {
      ideal = {
        obligations: monthlyIncome * 0.5,
        personal:    monthlyIncome * 0.3,
        investment:  monthlyIncome * 0.2
      };
      mainMessage = t('planner.insights.main_messages.fifty_thirty_twenty');
    }
    else {
      ideal = {
        obligations: monthlyIncome * 0.6,
        personal:    monthlyIncome * 0.25,
        investment:  monthlyIncome * 0.15
      };
      mainMessage = t('planner.insights.main_messages.sixty_twenty_fifteen');
    }

    // 3) build tips exactly as before
    const tips = [];
    if (actual.personal > ideal.personal) {
      const extra = actual.personal - ideal.personal;
      tips.push({
        type: 'warning',
        message: t('planner.insights.tips.overspending', { amount: extra.toFixed(1) }),
        details: [
          t('planner.insights.tips.saving_advice'),
          t('planner.insights.tips.annual_saving', { amount: (extra*12).toFixed(1) })
        ]
      });
    }
    if (actual.investment < ideal.investment * 0.9) {
      tips.push({
        type: 'alert',
        message: t('planner.insights.tips.low_savings'),
        details: [ t('planner.insights.tips.daily_saving') ]
      });
    }
    if (actual.investment >= ideal.investment && actual.personal < ideal.personal * 0.9) {
      tips.push({
        type: 'success',
        message: t('planner.insights.tips.excellent'),
        details: [ t('planner.insights.tips.keep_up') ]
      });
    }
    if (tips.length === 0) {
      tips.push({
        type: 'success',
        message: t('planner.insights.tips.perfect'),
        details: []
      });
    }

    setInsights({ mainMessage, tips, actual, ideal });
  };

  const destroyCharts = () => {
    if (budgetChartRef.current) {
      budgetChartRef.current.destroy();
      budgetChartRef.current = null;
    }
    if (comparisonChartRef.current) {
      comparisonChartRef.current.destroy();
      comparisonChartRef.current = null;
    }
    if (yearlyChartRef.current) {
      yearlyChartRef.current.destroy();
      yearlyChartRef.current = null;
    }
  };

  const updateBudgetChart = () => {
    if (budgetCanvasRef.current) {
      if (budgetChartRef.current) {
        budgetChartRef.current.destroy();
      }

      const ctx = budgetCanvasRef.current.getContext('2d');

      const totalExpenses = Object.values(expenses).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
      const remaining = monthlyIncome > totalExpenses ? monthlyIncome - totalExpenses : 0;

      const labels = [...Object.keys(expenses).map(key => t(`planner.budget.categories.${key}`))];
      const data = [...Object.values(expenses).map(v => parseFloat(v) || 0)];

      if (remaining > 0) {
        labels.push(t('planner.budget.remaining'));
        data.push(remaining);
      }

      const backgroundColors = [
        '#52741F', '#00B2F6', '#FF6B6B', '#4ECDC4', '#FF9F43',
        '#F368E0', '#FFD93D', '#6C5CE7', '#E69DB8', '#C599B6',
        '#00B894', '#A569BD'
      ];

      if (remaining > 0) {
        backgroundColors.push('#B7E0FF');
      }

      budgetChartRef.current = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: backgroundColors.slice(0, labels.length)
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                padding: 20
              }
            }
          }
        }
      });
    }
  };

  const destroyAnalysisCharts = () => {
    if (comparisonChartRef.current) {
      comparisonChartRef.current.destroy();
      comparisonChartRef.current = null;
    }
    if (yearlyChartRef.current) {
      yearlyChartRef.current.destroy();
      yearlyChartRef.current = null;
    }
  };

  const updateAnalysisCharts = () => {
    const obligationsCategories = ['housing', 'transportation', 'debt', 'health', 'education', 'maintenance', 'utilities'];
    const personalCategories = ['others', 'entertainment', 'charity', 'food'];
    const investmentCategories = ['savings'];

    const actual = {
      obligations: obligationsCategories.reduce((sum, cat) => sum + (parseFloat(expenses[cat]) || 0), 0),
      personal: personalCategories.reduce((sum, cat) => sum + (parseFloat(expenses[cat]) || 0), 0),
      investment: investmentCategories.reduce((sum, cat) => sum + (parseFloat(expenses[cat]) || 0), 0)
    };

    const idealPortion = monthlyIncome / 3;
    let ideal = { obligations: 0, personal: 0, investment: 0 };

    if (actual.obligations <= idealPortion) {
      ideal = {
        obligations: idealPortion,
        personal: idealPortion,
        investment: idealPortion
      };
    } else if (actual.obligations > idealPortion && actual.obligations <= monthlyIncome / 2) {
      ideal = {
        obligations: monthlyIncome * 0.5,
        personal: monthlyIncome * 0.3,
        investment: monthlyIncome * 0.2
      };
    } else {
      ideal = {
        obligations: monthlyIncome * 0.6,
        personal: monthlyIncome * 0.25,
        investment: monthlyIncome * 0.15
      };
    }

    if (comparisonCanvasRef.current) {
      if (comparisonChartRef.current) {
        comparisonChartRef.current.destroy();
      }

      const ctx = comparisonCanvasRef.current.getContext('2d');
      comparisonChartRef.current = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: [t('planner.analysis.obligations'), t('planner.analysis.personal'), t('planner.analysis.investment')],
          datasets: [
            {
              label: t('planner.analysis.your_spending'),
              data: [actual.obligations, actual.personal, actual.investment],
              backgroundColor: '#2A4B7C'
            },
            {
              label: t('planner.analysis.ideal_distribution'),
              data: [ideal.obligations, ideal.personal, ideal.investment],
              backgroundColor: '#00B894'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom'
            }
          }
        }
      });
    }

    if (yearlyCanvasRef.current) {
      if (yearlyChartRef.current) {
        yearlyChartRef.current.destroy();
      }

      const yearlyProjection = {
        current: Array.from({ length: 5 }, (_, i) => actual.investment * (i + 1) * 12),
        ideal: Array.from({ length: 5 }, (_, i) => ideal.investment * (i + 1) * 12)
      };

      const ctx = yearlyCanvasRef.current.getContext('2d');
      yearlyChartRef.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels: Array.from({ length: 5 }, (_, i) => t('planner.analysis.year', { year: i + 1 })),
          datasets: [
            {
              label: t('planner.analysis.current_investment'),
              data: yearlyProjection.current,
              borderColor: '#2A4B7C',
              fill: false
            },
            {
              label: t('planner.analysis.ideal_investment'),
              data: yearlyProjection.ideal,
              borderColor: '#00B894',
              fill: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom'
            }
          }
        }
      });
    }
  };

  const handleExpenseChange = (category, value) => {
    setExpenses(prev => ({
      ...prev,
      [category]: parseFloat(value) || 0
    }));
  };

  const handleStartAnalysis = async () => {
    if (!user) {
      toast.error(t('planner.errors.login_required'));
      navigate('/login');
      return;
    }

    if (isSaving) {
      return;
    }

    try {
      setIsSaving(true);

      const hasMatchingEntry = plannerHistory.some(entry => {
        return entry.monthlyIncome === monthlyIncome &&
          Object.entries(entry.expenses).every(([key, value]) => 
            Math.abs(value - expenses[key]) < 0.01
          );
      });

      if (!hasMatchingEntry) {
        await savePlannerEntry({
          monthlyIncome,
          expenses,
          date: new Date().toISOString() // حفظ التاريخ الحالي بالتوقيت العالمي
        });
        await fetchPlannerHistory();
        toast.success(t('planner.success.data_saved'));
      }
      
      setShowAnalysis(!showAnalysis);
    } catch (error) {
      console.error('Error saving plan:', error);
      toast.error(t('planner.errors.save_failed'));
    } finally {
      setIsSaving(false);
    }
  };

  const downloadPDF = () => {
    const element = document.querySelector('.analysis-container');
    if (!element) return;

    if (downloadBtnRef.current) {
      downloadBtnRef.current.style.display = 'none';
    }

    const opt = {
      margin: [0.5, 0.5, 0.5, 0.5],
      filename: 'Financial_Analysis_Report.pdf',
      image: { type: 'jpeg', quality: 1 },
      html2canvas: {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        scrollY: 0
      },
      jsPDF: {
        unit: 'cm',
        format: 'a3', // Wider and taller page size
        orientation: 'portrait'
      },
      pagebreak: { mode: ['avoid-all'] }
    };

    html2pdf()
      .set(opt)
      .from(element)
      .save()
      .then(() => {
        if (downloadBtnRef.current) {
          downloadBtnRef.current.style.display = '';
        }
      });
  };

  const totalExpenses = Object.values(expenses).reduce((sum, value) => sum + (parseFloat(value) || 0), 0);
  const remainingIncome = monthlyIncome - totalExpenses;

  // دالة لتنسيق التاريخ الميلادي بشكل واضح
  const formatGregorianDate = (dateString) => {
    const date = new Date(dateString);
    const options = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      calendar: 'gregory'
    };
    return date.toLocaleDateString('ar-EG', options);
  };

  return (
    <div className="budget-container">
      <div className="main-container">
        <h1 className="page-title">{t('planner.title')}</h1>
        <p className="subheading">{t('planner.subtitle')}</p>
        
        <div className="left-content">
          <div className="budget-section income-box">
            <h2 className="section-title">{t('planner.income.title')}</h2>
            {error && <div className="error-message" style={{ color: 'red', marginTop: '10px' }}>{error}</div>}

            <input
              type="number"
              className="amount-input"
              value={monthlyIncome}
              onChange={(e) => setMonthlyIncome(parseFloat(e.target.value) || 0)}
              placeholder={t('planner.income.placeholder')}
            />
          </div>

          <div className="budget-section">
            <h2 className="section-title">{t('planner.budget.title')}</h2>
            {Object.entries(expenses).map(([category, value]) => (
              <div key={category} className="budget-item">
                <div 
                  className="category-color"
                  style={{ 
                    backgroundColor: {
                      charity: '#52741F',
                      food: '#00B2F6',
                      housing: '#FF6B6B',
                      utilities: '#4ECDC4',
                      maintenance: '#FF9F43',
                      transportation: '#F368E0',
                      education: '#FFD93D',
                      entertainment: '#6C5CE7',
                      debt: '#E69DB8',
                      health: '#C599B6',
                      savings: '#00B894',
                      others: '#A569BD'
                    }[category]
                  }}
                />
                <span className="capitalize">{t(`planner.budget.categories.${category}`)}</span>
                <input
                  type="number"
                  className="amount-input"
                  value={value}
                  onChange={(e) => handleExpenseChange(category, e.target.value)}
                  placeholder={t('planner.budget.enter_expense', { category: t(`planner.budget.categories.${category}`) })}
                />
                <span className="percentage">
                  {((value / monthlyIncome) * 100 || 0).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>

          <div className="total-section">
            <span>{t('planner.totals.expenses')}:</span>
            <span>{totalExpenses.toFixed(2)} JOD</span>
          </div>

          <div className="remaining-income">
            <span>{t('planner.totals.remaining')}:</span>
            <span>{remainingIncome.toFixed(2)} JOD</span>
          </div>

          {user && showHistory && plannerHistory.length > 0 && (
            <div className="history-section budget-section">
              <h2 className="section-title">{t('planner.history.title')}</h2>
              {plannerHistory.map((entry, index) => {
                // تنسيق التاريخ الميلادي بشكل واضح
                const formattedDate = formatGregorianDate(entry.date);
                
                return (
                  <div key={entry._id} className="history-item">
                    <h3>{t('planner.history.plan', { number: index + 1, date: formattedDate })}</h3>
                    <div className="history-details">
                      <p>{t('planner.history.monthly_income')}: {entry.monthlyIncome.toFixed(2)} JOD</p>
                      <p>{t('planner.history.total_expenses')}: {entry.analysis.totalExpenses.toFixed(2)} JOD</p>
                      <p>{t('planner.history.savings_rate')}: {entry.analysis.savingsRate.toFixed(1)}%</p>
                      <p>{t('planner.history.debt_ratio')}: {entry.analysis.debtToIncomeRatio.toFixed(1)}%</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="sticky-wrapper">
          <div className="chart-container">
            <canvas ref={budgetCanvasRef}></canvas>
          </div>  
        </div>

        <div className="cta-section">
          <div className="cta-content">
            <h2>{t('planner.cta.title')}</h2>
            <p>{user ? t('planner.cta.logged_in') : t('planner.cta.login_prompt')}</p>
            <div className="cta-buttons">
              <button 
                className="save-button" 
                onClick={handleStartAnalysis}
                disabled={isSaving || !!error}
                title={error || ''}
              >
                <i className="fas fa-chart-pie"></i> 
                {isSaving 
                  ? t('planner.cta.processing') 
                  : error 
                    ? error 
                    : (showAnalysis ? t('planner.cta.hide_analysis') : t('planner.cta.start_analysis'))
                }
              </button>

              {user && (
                <button className="save-button" onClick={() => setShowHistory(!showHistory)}>
                  <i className="fas fa-history"></i> {showHistory ? t('planner.cta.hide_history') : t('planner.cta.view_history')}
                </button>
              )}
            </div>
          </div>
        </div>

        {showAnalysis && user && (
          <div className="analysis-container">
            <div className="analysis-header">
              <h2>{t('planner.analysis.title')}</h2>
              <div className="analysis-section">
                <h3>{t('planner.analysis.breakdown_title')}</h3>
                <ul>
                  <li>
                    <span className="font-bold">{t('planner.analysis.obligations')} (1/3):</span> 
                    {t('planner.analysis.obligations_list')}
                  </li>
                  <li>
                    <span className="font-bold">{t('planner.analysis.personal')} (1/3):</span> 
                    {t('planner.analysis.personal_list')}
                  </li>
                  <li>
                    <span className="font-bold">{t('planner.analysis.investment')} (1/3):</span> 
                    {t('planner.analysis.investment_list')}
                  </li>
                </ul>
              </div>
            </div>

            {insights && (
              <div className="insights-box">
                <h3>{t('planner.insights.title')}</h3>
                <div className="insights-content">
                  <p className="main-message">{insights.mainMessage}</p>
                  {insights.tips.map((tip, index) => (
                    <div key={index} className={`tip-box ${tip.type}`}>
                      <p className="tip-message">{tip.message}</p>
                      {tip.details.map((detail, i) => (
                        <p key={i} className="tip-detail">- {detail}</p>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="analysis-chart">
              <h3>{t('planner.analysis.comparison_title')}</h3>
              <canvas ref={comparisonCanvasRef}></canvas>
            </div>

            <div className="analysis-chart">
              <h3>{t('planner.analysis.projection_title')}</h3>
              <canvas ref={yearlyCanvasRef}></canvas>
            </div>

            <button 
              className="save-button" 
              onClick={downloadPDF} 
              ref={downloadBtnRef}
            >
              <i className="fas fa-file-download"></i> {t('planner.analysis.download_pdf')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Planner;