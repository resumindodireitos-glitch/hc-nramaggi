import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, UserCircle } from "lucide-react";

interface BiopsychosocialData {
  totalParticipants: number;
  genderDistribution: {
    male: number;
    female: number;
    other: number;
  };
  tenureDistribution: {
    lessThan1Year: number;
    between1And5Years: number;
    between5And10Years: number;
    moreThan10Years: number;
  };
  ageDistribution?: {
    under25: number;
    between25And35: number;
    between35And45: number;
    over45: number;
  };
}

interface BiopsychosocialProfileProps {
  data: BiopsychosocialData;
  title?: string;
}

export function BiopsychosocialProfile({ data, title = "Perfil Biopsicossocial dos Colaboradores" }: BiopsychosocialProfileProps) {
  const totalGender = data.genderDistribution.male + data.genderDistribution.female + data.genderDistribution.other;
  const totalTenure = data.tenureDistribution.lessThan1Year + 
    data.tenureDistribution.between1And5Years + 
    data.tenureDistribution.between5And10Years + 
    data.tenureDistribution.moreThan10Years;

  const genderPercent = (value: number) => totalGender > 0 ? ((value / totalGender) * 100).toFixed(1) : '0';
  const tenurePercent = (value: number) => totalTenure > 0 ? ((value / totalTenure) * 100).toFixed(1) : '0';

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Total Participants */}
        <div className="flex items-center justify-center p-4 bg-primary/5 rounded-lg">
          <div className="text-center">
            <p className="text-3xl font-bold text-primary">{data.totalParticipants}</p>
            <p className="text-sm text-muted-foreground">Colaboradores Participantes</p>
          </div>
        </div>

        {/* Gender Distribution */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <UserCircle className="h-4 w-4 text-muted-foreground" />
            Distribuição por Gênero
          </h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Masculino</span>
              <span className="text-sm font-medium">{data.genderDistribution.male} ({genderPercent(data.genderDistribution.male)}%)</span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${genderPercent(data.genderDistribution.male)}%` }}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">Feminino</span>
              <span className="text-sm font-medium">{data.genderDistribution.female} ({genderPercent(data.genderDistribution.female)}%)</span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-pink-500 rounded-full transition-all"
                style={{ width: `${genderPercent(data.genderDistribution.female)}%` }}
              />
            </div>

            {data.genderDistribution.other > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Outro/Não informado</span>
                  <span className="text-sm font-medium">{data.genderDistribution.other} ({genderPercent(data.genderDistribution.other)}%)</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-slate-500 rounded-full transition-all"
                    style={{ width: `${genderPercent(data.genderDistribution.other)}%` }}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Tenure Distribution */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            Tempo de Empresa
          </h4>
          <div className="space-y-2">
            <TenureBar 
              label="< 1 ano" 
              value={data.tenureDistribution.lessThan1Year} 
              percent={tenurePercent(data.tenureDistribution.lessThan1Year)}
              color="bg-emerald-500"
            />
            <TenureBar 
              label="1-5 anos" 
              value={data.tenureDistribution.between1And5Years} 
              percent={tenurePercent(data.tenureDistribution.between1And5Years)}
              color="bg-blue-500"
            />
            <TenureBar 
              label="5-10 anos" 
              value={data.tenureDistribution.between5And10Years} 
              percent={tenurePercent(data.tenureDistribution.between5And10Years)}
              color="bg-amber-500"
            />
            <TenureBar 
              label="> 10 anos" 
              value={data.tenureDistribution.moreThan10Years} 
              percent={tenurePercent(data.tenureDistribution.moreThan10Years)}
              color="bg-purple-500"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TenureBar({ label, value, percent, color }: { label: string; value: number; percent: string; color: string }) {
  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-sm">{label}</span>
        <span className="text-sm font-medium">{value} ({percent}%)</span>
      </div>
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full ${color} rounded-full transition-all`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </>
  );
}

export default BiopsychosocialProfile;
