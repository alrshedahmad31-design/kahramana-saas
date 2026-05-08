import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardHeader, CardTitle } from '@ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ui/table'
import { Badge } from '@ui/badge'
import { format } from 'date-fns'
import { User, Activity, Search } from 'lucide-react'
import { Input } from '@ui/input'

interface AuditLogData {
  id: string
  created_at: string
  action: string
  table_name: string
  changes: unknown
  user_id: string | null
}

export default async function AuditLogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: _locale } = await params
  const at = await getTranslations('dashboard.audit')
  
  const supabase = await createClient()
  
  const { data: logsData, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('Error fetching audit logs:', error)
  }

  const logs = (logsData as unknown as AuditLogData[]) ?? []

  const getActionColor = (action: string) => {
    switch (action.toUpperCase()) {
      case 'INSERT': return 'bg-green-500/10 text-green-400 border border-green-500/20'
      case 'UPDATE': return 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
      case 'DELETE': return 'bg-red-500/10 text-red-400 border border-red-500/20'
      default: return 'bg-brand-surface-2 text-brand-muted border border-brand-border'
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{at('title')}</h1>
          <p className="text-muted-foreground">{at('view_system_activity_description')}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{at('total_events')}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{logs.length}</div>
            <p className="text-xs text-muted-foreground">{at('last_100_events')}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{at('recent_activity')}</CardTitle>
            <div className="relative w-72">
              <Search className="absolute ps-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={at('filter_by_table_or_user')} className="ps-10" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[180px]">{at('timestamp')}</TableHead>
                  <TableHead>{at('user')}</TableHead>
                  <TableHead>{at('action')}</TableHead>
                  <TableHead>{at('table')}</TableHead>
                  <TableHead>{at('details')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-muted/5">
                    <TableCell className="font-mono text-xs">
                      {format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-xs font-mono text-muted-foreground">
                            {log.user_id?.slice(0, 8) ?? 'system'}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getActionColor(log.action)}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-xs uppercase tracking-wider text-muted-foreground">
                      {log.table_name}
                    </TableCell>
                    <TableCell>
                      <pre className="text-[10px] bg-muted/30 p-2 rounded max-h-24 overflow-auto max-w-[300px]">
                        {JSON.stringify(log.changes, null, 2)}
                      </pre>
                    </TableCell>
                  </TableRow>
                ))}
                {!logs.length && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      {at('no_audit_logs_found')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
