import { Link } from 'react-router-dom';
import { Info, Cpu, Package, LifeBuoy, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Card from '../components/Card';
import Logo from '../components/Logo';
import { version } from '../../package.json';

const features = [
  'AI-powered bug triage and prioritization',
  'Root cause analysis with AI suggestions',
  'Azure DevOps integration with sync',
  'Intelligent duplicate bug detection',
  'Real-time notifications and alerts',
  'Audit logging and activity tracking',
];

const techStack = [
  { category: 'Frontend', items: 'React 18, TypeScript, Vite, Tailwind CSS' },
  { category: 'Backend', items: 'FastAPI, Python 3.11' },
  { category: 'Database', items: 'PostgreSQL' },
  { category: 'AI/ML', items: 'LLM-powered analysis & embeddings' },
];

export default function AboutPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-primary-50 dark:from-gray-900 dark:to-gray-800">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Logo className="h-9 w-auto" />
          {user && (
            <Link
              to="/"
              className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to App
            </Link>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        <div className="flex items-center gap-2">
          <Info className="size-6 text-text-secondary" />
          <h1 className="page-title">About</h1>
        </div>

        <Card header={<span className="flex items-center gap-2 font-medium"><Info className="size-4" />App Info</span>}>
          <div className="space-y-3">
            <h2 className="text-xl font-semibold text-text-primary">AI Bug Triage & Root Cause Analyzer</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-text-muted">Version</span>
              <span className="px-2 py-0.5 text-xs font-medium bg-primary-50 text-primary-700 rounded-full">{version}</span>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">
              A comprehensive bug management platform that leverages artificial intelligence to streamline
              bug triage, identify root causes, and integrate seamlessly with Azure DevOps. Designed for
              engineering teams to reduce resolution time and improve product quality.
            </p>
          </div>
        </Card>

        <Card header={<span className="flex items-center gap-2 font-medium"><Cpu className="size-4" />Tech Stack</span>}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {techStack.map((item) => (
              <div key={item.category} className="space-y-1">
                <p className="text-sm font-medium text-text-primary">{item.category}</p>
                <p className="text-sm text-text-secondary">{item.items}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card header={<span className="flex items-center gap-2 font-medium"><Package className="size-4" />Features</span>}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {features.map((feature) => (
              <div key={feature} className="flex items-start gap-2">
                <CheckCircle2 className="size-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-text-secondary">{feature}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card header={<span className="flex items-center gap-2 font-medium"><LifeBuoy className="size-4" />Support</span>}>
          <p className="text-sm text-text-secondary mb-3">
            For questions, feature requests, or bug reports, please reach out to the development team.
          </p>
          <div className="text-sm text-text-secondary space-y-1">
            <p>
              <span className="font-medium text-text-primary">Documentation:</span>{' '}
              <a 
                href="https://github.com/SuriyaG894/AI-Bug-Triage/blob/main/docs/E2E_SUPPORT_GUIDE.md" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary-600 dark:text-primary-400 hover:underline"
              >
                E2E Support Guide
              </a>
            </p>
            <p>
              <span className="font-medium text-text-primary">Issues:</span>{' '}
              <a 
                href="https://github.com/SuriyaG894/AI-Bug-Triage/issues" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary-600 dark:text-primary-400 hover:underline"
              >
                Submit via GitHub Issues
              </a>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
