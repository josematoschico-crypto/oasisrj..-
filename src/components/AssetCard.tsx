import React from 'react';
import { ArtAsset } from '../types';
import InsuranceBadge from './InsuranceBadge';

interface AssetCardProps {
  asset: ArtAsset;
  onClick: () => void;
}

const AssetCard: React.FC<AssetCardProps> = ({ asset, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className="bg-slate-900/60 border border-slate-800/80 rounded-[2.5rem] p-4 flex flex-col shadow-xl active:scale-[0.99] transition-all hover:border-amber-500/20 group relative overflow-hidden cursor-pointer"
    >
      <div className="flex gap-4 items-center">
        <div className="h-24 w-24 rounded-2xl overflow-hidden shrink-0 border border-slate-700/30 relative">
          <img 
            src={asset.imageUrl} 
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
            alt={asset.title} 
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="flex-1 min-w-0 pr-2">
          <div className="mb-2">
            <p className="text-white text-[8px] font-black uppercase tracking-widest mb-0.5">{asset.artist}</p>
            <h4 className="text-white font-black text-xs truncate uppercase tracking-tight">{asset.title}</h4>
          </div>
          
          <div className="grid grid-cols-2 gap-y-2 gap-x-3 border-t border-slate-800/50 pt-2">
            <div>
              <p className="text-slate-600 text-[7px] font-black uppercase tracking-widest mb-0.5">Ano</p>
              <p className="text-white font-bold text-[10px]">{asset.year}</p>
            </div>
            <div className="text-right">
              <p className="text-slate-600 text-[7px] font-black uppercase tracking-widest mb-0.5">Preço/Fra</p>
              <p className="text-emerald-400 font-bold text-[10px]">R$ {asset.fractionPrice.toLocaleString('pt-BR')}</p>
            </div>
          </div>
          
          <div className="mt-2 flex items-center gap-2">
            <InsuranceBadge status={asset.insuranceStatus} />
            <span className="text-slate-600 text-[9px] font-bold uppercase tracking-widest">
              {asset.availableFractions} UN. DISP.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssetCard;
