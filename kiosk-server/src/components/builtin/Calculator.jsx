import { useState, useCallback, useEffect } from 'react';

function Calculator() {
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState(null);
  const [operation, setOperation] = useState(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const inputDigit = useCallback((digit) => {
    if (waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === '0' ? digit : display + digit);
    }
  }, [display, waitingForOperand]);

  const inputDecimal = useCallback(() => {
    if (waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
    } else if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  }, [display, waitingForOperand]);

  const clear = useCallback(() => {
    setDisplay('0');
    setPreviousValue(null);
    setOperation(null);
    setWaitingForOperand(false);
  }, []);

  const backspace = useCallback(() => {
    if (waitingForOperand) return;
    setDisplay(display.length === 1 ? '0' : display.slice(0, -1));
  }, [display, waitingForOperand]);

  const toggleSign = useCallback(() => {
    const value = parseFloat(display);
    setDisplay(String(value * -1));
  }, [display]);

  const percentage = useCallback(() => {
    const value = parseFloat(display);
    setDisplay(String(value / 100));
  }, [display]);

  const calculate = useCallback((left, right, op) => {
    switch (op) {
      case '+': return left + right;
      case '-': return left - right;
      case '×': return left * right;
      case '÷': return right !== 0 ? left / right : 'Error';
      default: return right;
    }
  }, []);

  const performOperation = useCallback((nextOperation) => {
    const inputValue = parseFloat(display);

    if (previousValue === null) {
      setPreviousValue(inputValue);
    } else if (operation) {
      const result = calculate(previousValue, inputValue, operation);
      setDisplay(String(result));
      setPreviousValue(result === 'Error' ? null : result);
    }

    setWaitingForOperand(true);
    setOperation(nextOperation);
  }, [display, previousValue, operation, calculate]);

  const equals = useCallback(() => {
    if (operation === null || previousValue === null) return;

    const inputValue = parseFloat(display);
    const result = calculate(previousValue, inputValue, operation);

    setDisplay(String(result));
    setPreviousValue(null);
    setOperation(null);
    setWaitingForOperand(true);
  }, [display, previousValue, operation, calculate]);

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Prevent default for calculator keys to avoid page scrolling etc.
      if (/^[0-9.+\-*/=%]$/.test(e.key) || ['Enter', 'Backspace', 'Delete', 'Escape'].includes(e.key)) {
        e.preventDefault();
      }

      // Digits
      if (/^[0-9]$/.test(e.key)) {
        inputDigit(e.key);
      }
      // Decimal
      else if (e.key === '.') {
        inputDecimal();
      }
      // Operations
      else if (e.key === '+') {
        performOperation('+');
      } else if (e.key === '-') {
        performOperation('-');
      } else if (e.key === '*' || e.key === 'x' || e.key === 'X') {
        performOperation('×');
      } else if (e.key === '/') {
        performOperation('÷');
      }
      // Equals
      else if (e.key === '=' || e.key === 'Enter') {
        equals();
      }
      // Clear
      else if (e.key === 'Escape' || e.key === 'Delete') {
        clear();
      }
      // Backspace
      else if (e.key === 'Backspace') {
        backspace();
      }
      // Percentage
      else if (e.key === '%') {
        percentage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inputDigit, inputDecimal, performOperation, equals, clear, backspace, percentage]);

  const Button = ({ onClick, className = '', children, span = 1 }) => (
    <button
      onClick={onClick}
      className={`
        h-16 sm:h-20 rounded-xl text-2xl sm:text-3xl font-medium
        transition-all active:scale-95
        ${span === 2 ? 'col-span-2' : ''}
        ${className}
      `}
    >
      {children}
    </button>
  );

  // Format display for large numbers
  const formatDisplay = (value) => {
    if (value === 'Error') return value;
    const num = parseFloat(value);
    if (isNaN(num)) return value;

    // If it's a whole number or has few decimals, show as is
    if (value.includes('.') && !value.endsWith('.')) {
      // Limit decimal places for display
      const parts = value.split('.');
      if (parts[1].length > 10) {
        return num.toPrecision(10);
      }
    }

    // Format large numbers with commas
    if (!value.includes('.') && value.length > 3) {
      return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
    }

    return value;
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Calculator body */}
        <div className="bg-slate-800 rounded-3xl p-4 shadow-2xl">
          {/* Display */}
          <div className="bg-slate-900 rounded-2xl p-4 mb-4 flex flex-col justify-end items-end">
            <div className="text-slate-500 text-lg mb-1 h-7">
              {operation && previousValue !== null ? `${previousValue} ${operation}` : '\u00A0'}
            </div>
            <div className="text-white text-5xl sm:text-6xl font-light tracking-tight overflow-hidden text-ellipsis max-w-full">
              {formatDisplay(display)}
            </div>
          </div>

          {/* Button grid */}
          <div className="grid grid-cols-4 gap-3">
            {/* Row 1 */}
            <Button onClick={clear} className="bg-slate-600 hover:bg-slate-500 text-white">
              AC
            </Button>
            <Button onClick={toggleSign} className="bg-slate-600 hover:bg-slate-500 text-white">
              +/-
            </Button>
            <Button onClick={percentage} className="bg-slate-600 hover:bg-slate-500 text-white">
              %
            </Button>
            <Button onClick={() => performOperation('÷')} className={`${operation === '÷' && waitingForOperand ? 'bg-white text-orange-500' : 'bg-orange-500 hover:bg-orange-400 text-white'}`}>
              ÷
            </Button>

            {/* Row 2 */}
            <Button onClick={() => inputDigit('7')} className="bg-slate-700 hover:bg-slate-600 text-white">
              7
            </Button>
            <Button onClick={() => inputDigit('8')} className="bg-slate-700 hover:bg-slate-600 text-white">
              8
            </Button>
            <Button onClick={() => inputDigit('9')} className="bg-slate-700 hover:bg-slate-600 text-white">
              9
            </Button>
            <Button onClick={() => performOperation('×')} className={`${operation === '×' && waitingForOperand ? 'bg-white text-orange-500' : 'bg-orange-500 hover:bg-orange-400 text-white'}`}>
              ×
            </Button>

            {/* Row 3 */}
            <Button onClick={() => inputDigit('4')} className="bg-slate-700 hover:bg-slate-600 text-white">
              4
            </Button>
            <Button onClick={() => inputDigit('5')} className="bg-slate-700 hover:bg-slate-600 text-white">
              5
            </Button>
            <Button onClick={() => inputDigit('6')} className="bg-slate-700 hover:bg-slate-600 text-white">
              6
            </Button>
            <Button onClick={() => performOperation('-')} className={`${operation === '-' && waitingForOperand ? 'bg-white text-orange-500' : 'bg-orange-500 hover:bg-orange-400 text-white'}`}>
              -
            </Button>

            {/* Row 4 */}
            <Button onClick={() => inputDigit('1')} className="bg-slate-700 hover:bg-slate-600 text-white">
              1
            </Button>
            <Button onClick={() => inputDigit('2')} className="bg-slate-700 hover:bg-slate-600 text-white">
              2
            </Button>
            <Button onClick={() => inputDigit('3')} className="bg-slate-700 hover:bg-slate-600 text-white">
              3
            </Button>
            <Button onClick={() => performOperation('+')} className={`${operation === '+' && waitingForOperand ? 'bg-white text-orange-500' : 'bg-orange-500 hover:bg-orange-400 text-white'}`}>
              +
            </Button>

            {/* Row 5 */}
            <Button onClick={() => inputDigit('0')} span={2} className="bg-slate-700 hover:bg-slate-600 text-white">
              0
            </Button>
            <Button onClick={inputDecimal} className="bg-slate-700 hover:bg-slate-600 text-white">
              .
            </Button>
            <Button onClick={equals} className="bg-orange-500 hover:bg-orange-400 text-white">
              =
            </Button>
          </div>

          {/* Backspace button */}
          <button
            onClick={backspace}
            className="w-full mt-3 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
            </svg>
            Backspace
          </button>
        </div>
      </div>
    </div>
  );
}

export default Calculator;
