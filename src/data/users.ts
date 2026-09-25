import { User } from '../types';

export const SEED_USERS: User[] = [
  {
    id: 'u1',
    name: 'A. Rivera',
    email: 'admin@plant.com',
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    title: 'Maintenance Manager'
  },
  {
    id: 'u2',
    name: 'John Doe',
    email: 'john@plant.com',
    username: 'john',
    password: 'tech123',
    role: 'technician',
    title: 'Senior Technician'
  },
  {
    id: 'u3',
    name: 'Maria Reyes',
    email: 'maria@plant.com',
    username: 'maria',
    password: 'view123',
    role: 'viewer',
    title: 'Plant Supervisor'
  }
];

export const DEMO_ACCOUNT = { email: 'admin@plant.com', username: 'admin', password: 'admin123' };