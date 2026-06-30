from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, serializers

from core.models import ServiceType
from core.permissions import IsCashierOrAbove, IsManagerOrAbove


class ServiceTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ServiceType
        fields = ['id', 'name', 'category', 'base_price', 'description', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']


class WriteServiceTypeSerializer(serializers.Serializer):
    name        = serializers.CharField(max_length=200)
    category    = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')
    base_price  = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0)
    description = serializers.CharField(max_length=500, required=False, allow_blank=True, default='')
    is_active   = serializers.BooleanField(required=False, default=True)


class ServiceTypeListCreateView(APIView):
    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsManagerOrAbove()]
        return [IsCashierOrAbove()]

    def get(self, request):
        qs = ServiceType.objects.filter(business=request.user.business)
        # Cashiers only see active ones; managers+ see all
        if request.user.role == 'cashier':
            qs = qs.filter(is_active=True)
        return Response(ServiceTypeSerializer(qs, many=True).data)

    def post(self, request):
        ser = WriteServiceTypeSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        d = ser.validated_data
        obj = ServiceType.objects.create(business=request.user.business, **d)
        return Response(ServiceTypeSerializer(obj).data, status=status.HTTP_201_CREATED)


class ServiceTypeDetailView(APIView):
    permission_classes = [IsManagerOrAbove]

    def get_object(self, request, pk):
        try:
            return ServiceType.objects.get(id=pk, business=request.user.business)
        except ServiceType.DoesNotExist:
            return None

    def patch(self, request, pk):
        obj = self.get_object(request, pk)
        if not obj:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        ser = WriteServiceTypeSerializer(data=request.data, partial=True)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        for k, v in ser.validated_data.items():
            setattr(obj, k, v)
        obj.save()
        return Response(ServiceTypeSerializer(obj).data)

    def delete(self, request, pk):
        obj = self.get_object(request, pk)
        if not obj:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
