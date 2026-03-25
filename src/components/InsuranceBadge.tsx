import React from 'react';
import { InsuranceStatus } from '../types';

interface InsuranceBadgeProps {
  status: InsuranceStatus;
}

const InsuranceBadge: React.FC<InsuranceBadgeProps> = ({ status }) => {
  const getStatusStyles = () => {
    switch (status) {
      case InsuranceStatus.SECURED:
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case InsuranceStatus.WARNING:
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case InsuranceStatus.EXPIRED:
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case InsuranceStatus.SECURED:
        return 'SEGURADO';
      case InsuranceStatus.WARNING:
        return 'ALERTA';
      case InsuranceStatus.EXPIRED:
        return 'EXPIRADO';
      default:
        return 'N/A';
    }
  };

  return (
    <div className={`px-2 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-widest ${getStatusStyles()}`}>
      {getStatusLabel()}
    </div>
  );
};

export default InsuranceBadge;
