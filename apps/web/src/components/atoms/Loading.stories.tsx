import type { Meta, StoryObj } from '@storybook/react-vite'
import { Skeleton, Spinner } from './Loading'

const meta = { title: 'Atoms/Loading', component: Spinner } satisfies Meta<typeof Spinner>
export default meta
type Story = StoryObj<typeof meta>

export const SpinnerStory: Story = { name: 'Spinner' }
export const SkeletonStory: Story = {
  name: 'Skeleton',
  render: () => (
    <div className="flex w-72 flex-col gap-3">
      <Skeleton className="h-9 w-11/12" />
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-5 w-4/5" />
    </div>
  ),
}
