import * as React from 'react';
import { AlertCircle, RefreshCcw, Home } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      let errorMessage = 'An unexpected error occurred.';
      let isFirestoreError = false;

      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error && parsed.operationType) {
            errorMessage = `Firestore Permission Denied: ${parsed.operationType} on ${parsed.path || 'unknown path'}`;
            isFirestoreError = true;
          }
        }
      } catch {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6 font-sans">
          <div className="w-full max-w-md rounded-[2.5rem] bg-white p-10 shadow-xl shadow-blue-900/5 text-center border border-gray-100">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-red-50 text-red-500">
              <AlertCircle size={40} />
            </div>
            
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Something went wrong</h1>
            <p className="mt-4 text-gray-500 font-medium leading-relaxed">
              {isFirestoreError ? (
                <span className="text-red-600 font-bold">{errorMessage}</span>
              ) : (
                errorMessage
              )}
            </p>

            <div className="mt-10 flex flex-col gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex items-center justify-center gap-2 rounded-2xl bg-[#003399] py-4 font-black text-white transition-all hover:bg-[#002266] active:scale-95 shadow-lg shadow-blue-900/20"
              >
                <RefreshCcw size={20} />
                Try Again
              </button>
              
              <button
                onClick={this.handleReset}
                className="flex items-center justify-center gap-2 rounded-2xl bg-gray-100 py-4 font-black text-gray-600 transition-all hover:bg-gray-200 active:scale-95"
              >
                <Home size={20} />
                Return to Home
              </button>
            </div>

            {isFirestoreError && (
              <p className="mt-8 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Security Rules Violation Detected
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
