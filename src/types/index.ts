export interface Message {
  id: string
  content: string
  username: string
  chatRoomId: string
  createdAt: Date
  updatedAt: Date
}

export interface ChatRoom {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
  messages?: Message[]
}
