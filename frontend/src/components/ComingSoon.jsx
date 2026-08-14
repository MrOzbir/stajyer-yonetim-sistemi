import { Construction } from 'lucide-react';

export default function ComingSoon({ title }) {
    return (
        <div className="card flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-xl bg-brand/15 text-brand-light flex items-center justify-center mb-4">
                <Construction size={26} />
            </div>
            <h2 className="text-xl font-bold mb-1">{title}</h2>
            <p className="text-white/40 text-sm">Bu sayfa çok yakında eklenecek. 🚧</p>
        </div>
    );
}