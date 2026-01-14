import { expect, test } from 'bun:test';
import { render } from '@testing-library/svelte';
import '../tests/setup'; 

test('App renders', async () => {
  const App = (await import('./App.svelte')).default;
  const { getByText } = render(App);
  expect(getByText('Hello, world!')).toBeTruthy();
});
