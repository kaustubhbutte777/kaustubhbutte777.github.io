import { Sandpack } from '@codesandbox/sandpack-react';

interface CodePlaygroundProps {
  template?: 'react' | 'vanilla' | 'vue' | 'svelte';
  files?: Record<string, string>;
  theme?: 'dark' | 'light';
}

const defaultFiles = {
  '/App.js': `export default function App() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontFamily: 'system-ui'
    }}>
      <h1>Hello, World!</h1>
      <p>Edit this code and see live changes!</p>
    </div>
  );
}`,
};

export default function CodePlayground({
  template = 'react',
  files = defaultFiles,
  theme = 'dark',
}: CodePlaygroundProps) {
  return (
    <div className="rounded-xl overflow-hidden border border-white/10">
      <Sandpack
        template={template}
        files={files}
        theme={theme === 'dark' ? 'dark' : 'light'}
        options={{
          showNavigator: false,
          showTabs: true,
          showLineNumbers: true,
          showInlineErrors: true,
          wrapContent: true,
          editorHeight: 350,
          editorWidthPercentage: 55,
        }}
        customSetup={{
          dependencies: {},
        }}
      />
    </div>
  );
}
