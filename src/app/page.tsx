import { redirect } from 'next/navigation';
import { DEFAULT_CLIENT_ID } from '@/data/clients';

export default function Home() {
  redirect(`/clients/${DEFAULT_CLIENT_ID}/dashboard`);
}
