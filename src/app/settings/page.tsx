import SettingsView from './SettingsView'

type Props = { searchParams?: Promise<{ section?: string }> }

export default async function SettingsPage(props: Props) {
  const searchParams = await (props.searchParams ?? Promise.resolve({})) as { section?: string }
  const section = searchParams.section ?? null
  return <SettingsView initialSection={section} />
}
