import { PropertyConfig } from './types';

export const propertyConfig: PropertyConfig = {
  projectName: 'the Urbana',
  credits: 'Experience by Lost in Renders',
  defaultRoomId: 'living',

  contact: {
    company: 'Lost in Renders',
    email: 'shobhitbadonia22@gmail.com',
    phone: '+91 9752028045',
    address: 'Urbana Prime Residences, Architectural Enclave'
  },

  location: {
    latitude: 23.1815,
    longitude: 79.9864,
    zoom: 14,
    displayName: 'The Urbana Residency, Architectural District'
  },

  floorPlan: {
    name: 'FLOOR PLAN',
    image: '/assets/floorplan/blueprint.png',
    aspectRatio: 1.0942 // 1312 / 1199 native blueprint aspect ratio
  },

  audio: {
    enabled: true,
    src: '/assets/audio/background-music.mp3',
    defaultVolume: 0.4
  },

  rooms: {
    living: {
      id: 'living',
      name: 'Living Room',
      panorama: {
        preview: '/assets/panoramas/living-room-preview.webp',
        standard: '/assets/panoramas/living-room.jpg'
      },
      initialCamera: {
        yaw: 0,
        pitch: -2,
        fov: 75
      },
      adjacentRooms: ['dining', 'kitchen', 'master', 'guest'],
      floorPlanCoords: {
        top: '26%',
        left: '70%',
        yawOffset: 205
      },
      hotspots: [
        {
          id: 'living-to-dining',
          targetRoomId: 'dining',
          label: 'Dining Room',
          icon: '/assets/hotspots/dining-table.png',
          yaw: 90,
          pitch: -3
        },
        {
          id: 'living-to-kitchen',
          targetRoomId: 'kitchen',
          label: 'Kitchen',
          icon: '/assets/hotspots/kitchen-table.png',
          yaw: 54,
          pitch: -4
        },
        {
          id: 'living-to-master',
          targetRoomId: 'master',
          label: 'Master Bedroom',
          icon: '/assets/hotspots/bed.png',
          yaw: 130,
          pitch: -3
        },
        {
          id: 'living-to-guest',
          targetRoomId: 'guest',
          label: 'Guest Bedroom',
          icon: '/assets/hotspots/bed.png',
          yaw: 144,
          pitch: -3
        }
      ]
    },

    dining: {
      id: 'dining',
      name: 'Dining Room',
      panorama: {
        preview: '/assets/panoramas/dining-room-preview.webp',
        standard: '/assets/panoramas/dining-room.jpg'
      },
      initialCamera: {
        yaw: 70,
        pitch: -2,
        fov: 75
      },
      adjacentRooms: ['living', 'kitchen', 'master'],
      floorPlanCoords: {
        top: '59%',
        left: '56%',
        yawOffset: 200
      },
      hotspots: [
        {
          id: 'dining-to-living',
          targetRoomId: 'living',
          label: 'Living Room',
          icon: '/assets/hotspots/livingroom.png',
          yaw: -104,
          pitch: -3
        },
        {
          id: 'dining-to-kitchen',
          targetRoomId: 'kitchen',
          label: 'Kitchen',
          icon: '/assets/hotspots/kitchen-table.png',
          yaw: -72,
          pitch: -4
        },
        {
          id: 'dining-to-master',
          targetRoomId: 'master',
          label: 'Master Bedroom',
          icon: '/assets/hotspots/bed.png',
          yaw: -144,
          pitch: -3
        }
      ]
    },

    master: {
      id: 'master',
      name: 'Master Bedroom',
      panorama: {
        preview: '/assets/panoramas/bedroom-1-preview.webp',
        standard: '/assets/panoramas/bedroom-1.jpg'
      },
      initialCamera: {
        yaw: 75,
        pitch: -3,
        fov: 75
      },
      adjacentRooms: ['living', 'bathroom', 'guest'],
      floorPlanCoords: {
        top: '21%',
        left: '22%',
        yawOffset: 280
      },
      hotspots: [
        {
          id: 'master-to-bathroom',
          targetRoomId: 'bathroom',
          label: 'En-Suite Bathroom',
          icon: '/assets/hotspots/bathroom.png',
          yaw: -83,
          pitch: -4
        },
        {
          id: 'master-to-living',
          targetRoomId: 'living',
          label: 'Living Room',
          icon: '/assets/hotspots/livingroom.png',
          yaw: -97,
          pitch: -4
        },
        {
          id: 'master-to-guest',
          targetRoomId: 'guest',
          label: 'Guest Bedroom',
          icon: '/assets/hotspots/bed.png',
          yaw: -108,
          pitch: -4
        }
      ]
    },

    guest: {
      id: 'guest',
      name: 'Guest Bedroom',
      panorama: {
        preview: '/assets/panoramas/bedroom-2-preview.webp',
        standard: '/assets/panoramas/bedroom-2.jpg'
      },
      initialCamera: {
        yaw: 90,
        pitch: -3,
        fov: 75
      },
      adjacentRooms: ['living', 'master'],
      floorPlanCoords: {
        top: '67%',
        left: '24%',
        yawOffset: 90
      },
      hotspots: [
        {
          id: 'guest-to-living',
          targetRoomId: 'living',
          label: 'Living Room',
          icon: '/assets/hotspots/livingroom.png',
          yaw: 43,
          pitch: -3
        },
        {
          id: 'guest-to-master',
          targetRoomId: 'master',
          label: 'Master Bedroom',
          icon: '/assets/hotspots/bed.png',
          yaw: 32,
          pitch: -3
        }
      ]
    },

    kitchen: {
      id: 'kitchen',
      name: 'Kitchen',
      panorama: {
        preview: '/assets/panoramas/kitchen-preview.webp',
        standard: '/assets/panoramas/kitchen.jpg'
      },
      initialCamera: {
        yaw: 0,
        pitch: -3,
        fov: 75
      },
      adjacentRooms: ['living', 'dining'],
      floorPlanCoords: {
        top: '60%',
        left: '80%',
        yawOffset: 180
      },
      hotspots: [
        {
          id: 'kitchen-to-living',
          targetRoomId: 'living',
          label: 'Living Room',
          icon: '/assets/hotspots/livingroom.png',
          yaw: -118,
          pitch: -3
        },
        {
          id: 'kitchen-to-dining',
          targetRoomId: 'dining',
          label: 'Dining Room',
          icon: '/assets/hotspots/dining-table.png',
          yaw: -133,
          pitch: -4
        }
      ]
    },

    bathroom: {
      id: 'bathroom',
      name: 'Bathroom',
      panorama: {
        preview: '/assets/panoramas/bathroom-preview.webp',
        standard: '/assets/panoramas/bathroom.jpg'
      },
      initialCamera: {
        yaw: 0,
        pitch: -3,
        fov: 75
      },
      adjacentRooms: ['master', 'living'],
      floorPlanCoords: {
        top: '19%',
        left: '43%',
        yawOffset: 180
      },
      hotspots: [
        {
          id: 'bathroom-to-master',
          targetRoomId: 'master',
          label: 'Master Bedroom',
          icon: '/assets/hotspots/bed.png',
          yaw: 72,
          pitch: -3
        },
        {
          id: 'bathroom-to-living',
          targetRoomId: 'living',
          label: 'Living Room',
          icon: '/assets/hotspots/livingroom.png',
          yaw: 83,
          pitch: -3
        }
      ]
    }
  },

  gallery: [
    {
      id: 'living',
      roomId: 'living',
      title: 'Living Room',
      photos: [
        {
          url: '/assets/gallery/living-room.webp',
          thumbnailUrl: '/assets/gallery/living-room-thumb.webp',
          caption: 'Spacious light-flooded architectural living area'
        }
      ],
      scatterPreset: {
        x: -22,
        y: -18,
        rotate: -3.2,
        width: 290,
        height: 200,
        zIndex: 4,
        windPeriod: 4.8,
        windPhase: 0.3
      }
    },
    {
      id: 'master',
      roomId: 'master',
      title: 'Master Bedroom',
      photos: [
        {
          url: '/assets/gallery/bedroom-1.webp',
          thumbnailUrl: '/assets/gallery/bedroom-1-thumb.webp',
          caption: 'Primary master bedroom sanctuary with minimalist aesthetics'
        }
      ],
      scatterPreset: {
        x: 18,
        y: -22,
        rotate: 3.5,
        width: 310,
        height: 215,
        zIndex: 5,
        windPeriod: 5.4,
        windPhase: 1.2
      }
    },
    {
      id: 'guest',
      roomId: 'guest',
      title: 'Guest Bedroom',
      photos: [
        {
          url: '/assets/gallery/bedroom-2.webp',
          thumbnailUrl: '/assets/gallery/bedroom-2-thumb.webp',
          caption: 'Refined guest bedroom suite featuring panoramic city views'
        }
      ],
      scatterPreset: {
        x: 28,
        y: 18,
        rotate: 2.6,
        width: 285,
        height: 195,
        zIndex: 4,
        windPeriod: 5.8,
        windPhase: 5.7
      }
    },
    {
      id: 'dining',
      roomId: 'dining',
      title: 'Dining Room',
      photos: [
        {
          url: '/assets/gallery/dining-room.webp',
          thumbnailUrl: '/assets/gallery/dining-room-thumb.webp',
          caption: 'Refined dining arrangement with sculptural lighting'
        }
      ],
      scatterPreset: {
        x: 6,
        y: 4,
        rotate: -2.1,
        width: 275,
        height: 190,
        zIndex: 3,
        windPeriod: 4.2,
        windPhase: 2.5
      }
    },
    {
      id: 'kitchen',
      roomId: 'kitchen',
      title: 'Kitchen',
      photos: [
        {
          url: '/assets/gallery/kitchen.webp',
          thumbnailUrl: '/assets/gallery/kitchen-thumb.webp',
          caption: 'High-precision culinary space with custom cabinetry'
        }
      ],
      scatterPreset: {
        x: -14,
        y: 26,
        rotate: -2.8,
        width: 300,
        height: 200,
        zIndex: 4,
        windPeriod: 4.6,
        windPhase: 4.9
      }
    },
    {
      id: 'bathroom',
      roomId: 'bathroom',
      title: 'Bathroom',
      photos: [
        {
          url: '/assets/gallery/bathroom.webp',
          thumbnailUrl: '/assets/gallery/bathroom-thumb.webp',
          caption: 'Monolithic stone spa bathroom with walk-in enclosure'
        }
      ],
      scatterPreset: {
        x: -36,
        y: 8,
        rotate: 4.0,
        width: 250,
        height: 240,
        zIndex: 2,
        windPeriod: 5.0,
        windPhase: 3.8
      }
    }
  ]
};
