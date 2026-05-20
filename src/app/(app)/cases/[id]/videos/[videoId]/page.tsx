import VideoAnalysisPage from '@/components/rehab/VideoAnalysisPage'

interface Props {
  params: Promise<{ id: string; videoId: string }>
}

export default async function VideoPage({ params }: Props) {
  const { id, videoId } = await params
  return <VideoAnalysisPage caseId={id} videoId={videoId} />
}
