import { ArtAsset, InsuranceStatus } from './types';

export const MOCK_ASSETS: ArtAsset[] = [
  {
    id: '1',
    title: 'Metaesquema',
    artist: 'Hélio Oiticica',
    year: '1958',
    totalValue: 150000,
    fractionPrice: 15,
    totalFractions: 10000,
    availableFractions: 8500,
    imageUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=1000&auto=format&fit=crop',
    gallery: [
      { id: 'g1', imageUrl: 'https://images.unsplash.com/photo-1549490349-8643362247b5?q=80&w=500', title: 'Estudo de Cor', year: '1957' },
      { id: 'g2', imageUrl: 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?q=80&w=500', title: 'Metaesquema II', year: '1958' }
    ],
    insuranceStatus: InsuranceStatus.SECURED,
    insuranceCompany: 'Oasis Safe',
    policyNumber: 'ALZ-9921-X',
    insuranceExpiry: '2026-12-31',
    technicalReportUrl: '#',
    description: 'Obra icônica do movimento neoconcreto brasileiro, explorando a geometria e o espaço.',
  },
  {
    id: '2',
    title: 'Bicho',
    artist: 'Lygia Clark',
    year: '1960',
    totalValue: 250000,
    fractionPrice: 25,
    totalFractions: 10000,
    availableFractions: 4200,
    imageUrl: 'https://images.unsplash.com/photo-1554188248-986adbb73be4?q=80&w=1000&auto=format&fit=crop',
    gallery: [
      { id: 'g3', imageUrl: 'https://images.unsplash.com/photo-1561214115-f2f134cc4912?q=80&w=500', title: 'Bicho - Estudo', year: '1959' }
    ],
    insuranceStatus: InsuranceStatus.SECURED,
    insuranceCompany: 'Oasis Safe',
    policyNumber: 'ALZ-9922-Y',
    insuranceExpiry: '2026-12-31',
    technicalReportUrl: '#',
    description: 'Escultura interativa que convida o espectador à manipulação, rompendo a barreira entre arte e público.',
  }
];
