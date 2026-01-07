import { Specialization } from '../types';

export const specializations: Specialization[] = [
  {
    id: 'offshore-contracts',
    name: 'Offshore Contracts',
    description: 'International service agreements for remote work',
    publicKey: 'pk_9e90fab19e5a64da2576238a33b2bfe2d9c18a592189ab77',
  },
  // Add more specializations here as you create more Okidoki apps
  // {
  //   id: 'vehicle-transfers',
  //   name: 'Vehicle Transfers',
  //   description: 'Car sale and transfer documents',
  //   publicKey: 'pk_YOUR_PUBLIC_KEY_HERE',
  // },
];

export const defaultSpecialization = specializations[0];

