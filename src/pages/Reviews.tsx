import { NotebookPen } from 'lucide-react';

const Reviews = () => (
  <div className="p-6 md:p-8 max-w-3xl mx-auto">
    <h1 className="font-display text-3xl font-semibold">Reviews</h1>
    <p className="text-sm text-muted-foreground mt-1 mb-8">Weekly and monthly reflections on your trading.</p>
    <div className="glass rounded-2xl p-12 text-center">
      <div className="size-12 rounded-full bg-secondary mx-auto flex items-center justify-center mb-4">
        <NotebookPen className="size-5 text-primary" />
      </div>
      <h3 className="font-display text-xl font-semibold mb-1">Reviews coming soon</h3>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto">
        Structured weekly and monthly reviews with goal tracking and habit tracking will land in the next iteration.
      </p>
    </div>
  </div>
);

export default Reviews;
