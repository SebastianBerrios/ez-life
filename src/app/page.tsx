import MainFlow from '../presentation/components/MainFlow';

// Each MainFlow step renders its own <main> landmark (login, wizard, app shell): no wrapper here, so
// the page never has two nested main landmarks.
export default function Home() {
  return <MainFlow />;
}
