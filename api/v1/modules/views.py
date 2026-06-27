from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import serializers
from core.models import Module, BusinessModule


class ModuleSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Module
        fields = ['id', 'code', 'name', 'description', 'sort_order']


class ActiveModuleSerializer(serializers.ModelSerializer):
    module = ModuleSerializer(read_only=True)

    class Meta:
        model  = BusinessModule
        fields = ['id', 'module', 'is_active', 'activated_at']


class ModuleListView(APIView):
    """List all available modules — public, used during onboarding."""
    permission_classes = [AllowAny]

    def get(self, request):
        modules = Module.objects.filter(is_active=True).order_by('sort_order')
        serializer = ModuleSerializer(modules, many=True)
        return Response(serializer.data)


class ActiveModulesView(APIView):
    """List modules this business has activated."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        business_modules = BusinessModule.objects.filter(
            business=request.user.business
        ).select_related('module')
        serializer = ActiveModuleSerializer(business_modules, many=True)
        return Response(serializer.data)


class ActivateModulesView(APIView):
    """Activate one or more modules for this business."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        module_ids = request.data.get('module_ids', [])

        if not module_ids:
            return Response(
                {'error': 'module_ids is required.'},
                status=400
            )

        modules = Module.objects.filter(id__in=module_ids, is_active=True)

        if not modules.exists():
            return Response(
                {'error': 'No valid modules found.'},
                status=400
            )

        activated = []
        already_active = []

        for module in modules:
            bm, created = BusinessModule.objects.get_or_create(
                business=request.user.business,
                module=module,
                defaults={'created_by': request.user}
            )
            if created:
                activated.append(module.name)
            else:
                if not bm.is_active:
                    bm.is_active = True
                    bm.save()
                    activated.append(module.name)
                else:
                    already_active.append(module.name)

        return Response({
            'message': f'{len(activated)} module(s) activated.',
            'activated': activated,
            'already_active': already_active,
        }, status=201)


class ToggleModuleView(APIView):
    """Deactivate or reactivate a module."""
    permission_classes = [IsAuthenticated]

    def patch(self, request, module_id):
        try:
            bm = BusinessModule.objects.get(
                business=request.user.business,
                module_id=module_id
            )
        except BusinessModule.DoesNotExist:
            return Response({'error': 'Module not found.'}, status=404)

        is_active = request.data.get('is_active')
        if is_active is None:
            return Response({'error': 'is_active field is required.'}, status=400)

        bm.is_active = is_active
        bm.save()

        status_text = 'activated' if is_active else 'deactivated'
        return Response({
            'message': f'Module {status_text} successfully.',
            'module': bm.module.name,
            'is_active': bm.is_active,
        })