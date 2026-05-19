import { describe, it, expect } from 'vitest';
import { stripCodeFences, ensureRenderCall } from '../utils';

describe('stripCodeFences', () => {
  it('기본 코드 펜스 제거 (jsx)', () => {
    const input = '```jsx\nconst App = () => <div>Hello</div>;\n```';
    const result = stripCodeFences(input);
    expect(result).toBe("const App = () => <div>Hello</div>;");
  });

  it('기본 코드 펜스 제거 (typescript)', () => {
    const input = '```typescript\nconst x: number = 5;\n```';
    const result = stripCodeFences(input);
    expect(result).toBe('const x: number = 5;');
  });

  it('언어 지정 없는 코드 펜스 제거', () => {
    const input = '```\nrender(<Comp />);\n```';
    const result = stripCodeFences(input);
    expect(result).toBe('render(<Comp />);');
  });

  it('끝의 공백이 있는 코드 펜스 제거 (evaluator 이슈 #1)', () => {
    const input = '```jsx\nconst Btn = () => <button>Click</button>;\n```  ';
    const result = stripCodeFences(input);
    expect(result).toBe('const Btn = () => <button>Click</button>;');
  });

  it('끝의 탭과 개행이 있는 코드 펜스 제거', () => {
    const input = '```javascript\nlet x = 1;\n```\t\n';
    const result = stripCodeFences(input);
    expect(result).toBe('let x = 1;');
  });

  it('여러 코드 블록 처리', () => {
    const input = '```js\ncode1\n```\n\n```ts\ncode2\n```';
    const result = stripCodeFences(input);
    expect(result).toContain('code1');
    expect(result).toContain('code2');
  });

  it('펜스 없는 코드는 그대로 반환', () => {
    const input = 'const Comp = () => <div>Test</div>;';
    const result = stripCodeFences(input);
    expect(result).toBe(input);
  });

  it('시작 펜스만 있는 경우 처리', () => {
    const input = '```jsx\nconst App = () => null;';
    const result = stripCodeFences(input);
    expect(result).toBe('const App = () => null;');
  });
});

describe('ensureRenderCall', () => {
  it('render() 호출이 있으면 그대로 반환', () => {
    const input = 'const Btn = () => <button>Click</button>;\n\nrender(<Btn />);';
    const result = ensureRenderCall(input);
    expect(result).toBe(input);
  });

  it('const 선언된 컴포넌트에 render() 추가', () => {
    const input = 'const MyButton = () => <button>Click</button>;';
    const result = ensureRenderCall(input);
    expect(result).toContain('render(<MyButton />);');
    expect(result).toContain('const MyButton');
  });

  it('function 선언된 컴포넌트에 render() 추가', () => {
    const input = 'function MyCard() { return <div>Card</div>; }';
    const result = ensureRenderCall(input);
    expect(result).toContain('render(<MyCard />);');
  });

  it('화살표 함수 컴포넌트에 render() 추가 (evaluator 이슈 #2)', () => {
    const input = 'const Button = () => <button>Click</button>;';
    const result = ensureRenderCall(input);
    expect(result).toContain('render(<Button />);');
  });

  it('export const 컴포넌트에 render() 추가 (evaluator 이슈 #2)', () => {
    const input = 'export const AppComponent = () => <div>App</div>;';
    const result = ensureRenderCall(input);
    expect(result).toContain('render(<AppComponent />);');
  });

  it('export function 컴포넌트에 render() 추가', () => {
    const input = 'export function Dashboard() { return <div>Dashboard</div>; }';
    const result = ensureRenderCall(input);
    expect(result).toContain('render(<Dashboard />);');
  });

  it('render() 호출이 이미 있으면 중복 추가 안 함', () => {
    const input = 'const Modal = () => <div>Modal</div>;\n\nrender(<Modal />);';
    const result = ensureRenderCall(input);
    expect(result).toBe(input);
  });

  it('컴포넌트 이름이 없으면 추가 안 함', () => {
    const input = '() => <div>Anonymous</div>';
    const result = ensureRenderCall(input);
    expect(result).toBe(input);
  });

  it('소문자로 시작하는 함수는 무시', () => {
    const input = 'const helper = () => null;';
    const result = ensureRenderCall(input);
    expect(result).toBe(input);
  });

  it('복잡한 컴포넌트 코드도 정확히 처리', () => {
    const input = `const Card = ({ title, children }) => (
  <div style={{ border: '1px solid #ccc', padding: '16px' }}>
    <h3>{title}</h3>
    {children}
  </div>
);`;
    const result = ensureRenderCall(input);
    expect(result).toContain('render(<Card />);');
    expect(result).toContain('const Card');
  });
});
