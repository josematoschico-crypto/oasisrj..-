import React from 'react';

interface GuaranteeBarProps {
  expiryDate: string;
}

const GuaranteeBar: React.FC<GuaranteeBarProps> = ({ expiryDate }) => {
  const calculateProgress = () => {
    const now = new Date();
    const expiry = new Date(expiryDate);
    const start = new Date(expiry);
    start.setFullYear(start.getFullYear() - 1);
    
    const total = expiry.getTime() - start.getTime();
    const current = expiry.getTime() - now.getTime();
    
    const progress = Math.max(0, Math.min(100, (current / total) * 100));
    return progress;
  };

  const progress = calculateProgress();

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Vigência da Apólice</span>
        <span className="text-[9px] text-white font-black uppercase tracking-widest">{new Date(expiryDate).toLocaleDateString('pt-BR')}</span>
      </div>
      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-1000 ${progress > 20 ? 'bg-emerald-500' : 'bg-red-500'}`}
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    </div>
  );
};

export default GuaranteeBar;
