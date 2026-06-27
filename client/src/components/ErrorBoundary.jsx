import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(err) {
    return { error: err };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <code className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded max-w-lg block break-all">
            {this.state.error.message}
          </code>
          <Button onClick={() => window.location.reload()}>Reload app</Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
